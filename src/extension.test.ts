import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import {
  REQUIRED_EXTENSION_ARCHIVE_NAME,
  REQUIRED_EXTENSION_SHA256,
  REQUIRED_EXTENSION_URL,
  downloadRequiredExtensionArchive,
  ensureRequiredExtensionArchive,
  installRequiredExtension,
  prepareRequiredExtension,
} from "./extension.js";

function createExtensionArchiveFixture() {
  const zip = new AdmZip();

  zip.addFile(
    "opencli-extension/manifest.json",
    Buffer.from(
      JSON.stringify({
        manifest_version: 3,
        name: "OpenCLI Test Extension",
        version: "0.0.0",
      })
    )
  );
  zip.addFile("opencli-extension/background.js", Buffer.from("console.log('test')\n"));

  return zip.toBuffer();
}

test("downloadRequiredExtensionArchive fetches the pinned extension asset into the cache directory", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-extension-"));
  const extensionsDir = path.join(tempRoot, "extensions");
  const fixture = createExtensionArchiveFixture();
  const requests: string[] = [];

  const archivePath = await downloadRequiredExtensionArchive(extensionsDir, {
    fetchImpl: async (input: string | URL | Request) => {
      requests.push(String(input));
      return new Response(fixture);
    },
    validateExtensionArchive: () => undefined,
  });

  assert.deepEqual(requests, [REQUIRED_EXTENSION_URL]);
  assert.equal(path.basename(archivePath), REQUIRED_EXTENSION_ARCHIVE_NAME);
  assert.deepEqual(fs.readFileSync(archivePath), fixture);
});

test("ensureRequiredExtensionArchive keeps a valid existing archive", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-extension-"));
  const extensionsDir = path.join(tempRoot, "extensions");
  const archivePath = path.join(extensionsDir, REQUIRED_EXTENSION_ARCHIVE_NAME);

  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.writeFileSync(archivePath, "existing archive");

  const result = await ensureRequiredExtensionArchive(extensionsDir, {
    validateExtensionArchive: () => undefined,
    downloadRequiredExtension: async () => {
      throw new Error("should not download a valid archive");
    },
  });

  assert.equal(result, archivePath);
});

test("ensureRequiredExtensionArchive repairs an invalid archive by downloading a fresh copy", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-extension-"));
  const extensionsDir = path.join(tempRoot, "extensions");
  const archivePath = path.join(extensionsDir, REQUIRED_EXTENSION_ARCHIVE_NAME);
  let validateCalls = 0;
  let downloadCalls = 0;

  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.writeFileSync(archivePath, "broken archive");

  const result = await ensureRequiredExtensionArchive(extensionsDir, {
    validateExtensionArchive: () => {
      validateCalls += 1;
      if (validateCalls === 1) {
        throw new Error("invalid archive");
      }
    },
    downloadRequiredExtension: async () => {
      downloadCalls += 1;
      fs.writeFileSync(archivePath, "fresh archive");
      return archivePath;
    },
  });

  assert.equal(result, archivePath);
  assert.equal(validateCalls, 2);
  assert.equal(downloadCalls, 1);
});

test("prepareRequiredExtension extracts the required extension and returns a manifest root", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-extension-"));
  const extensionsDir = path.join(tempRoot, "extensions");
  const archivePath = path.join(extensionsDir, REQUIRED_EXTENSION_ARCHIVE_NAME);

  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.writeFileSync(archivePath, createExtensionArchiveFixture());

  const extensionPath = await prepareRequiredExtension(extensionsDir, {
    ensureRequiredExtensionArchive: async () => archivePath,
  });

  assert.ok(fs.existsSync(path.join(extensionPath, "manifest.json")));
});

test("validateExtensionArchive rejects a structurally valid archive with the wrong digest", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-extension-"));
  const archivePath = path.join(tempRoot, REQUIRED_EXTENSION_ARCHIVE_NAME);

  fs.writeFileSync(archivePath, createExtensionArchiveFixture());

  await assert.rejects(
    async () => {
      const { validateExtensionArchive } = await import("./extension.js");
      validateExtensionArchive(archivePath);
    },
    new RegExp(`expected ${REQUIRED_EXTENSION_SHA256}`)
  );
});

test("installRequiredExtension stores the archive in the configured cache directory", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-extension-"));
  const expectedArchivePath = path.join(tempRoot, REQUIRED_EXTENSION_ARCHIVE_NAME);
  const seenExtensionsDirs: string[] = [];

  const archivePath = await installRequiredExtension(tempRoot, {
    validateExtensionArchive: () => undefined,
    downloadRequiredExtension: async (extensionsDir: string) => {
      seenExtensionsDirs.push(extensionsDir);
      fs.mkdirSync(extensionsDir, { recursive: true });
      fs.writeFileSync(expectedArchivePath, "archive");
      return expectedArchivePath;
    },
    log: () => undefined,
  });

  assert.deepEqual(seenExtensionsDirs, [tempRoot]);
  assert.equal(archivePath, expectedArchivePath);
});
