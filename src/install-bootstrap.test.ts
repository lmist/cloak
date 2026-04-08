import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { bootstrapInstall } from "./install-bootstrap.js";

test("bootstrapInstall prepares app directories and extension after prompt approval", async () => {
  const mkdirCalls: string[] = [];
  const installCalls: string[] = [];

  const result = await bootstrapInstall("/tmp/cloak", {
    env: {},
    pathExists: () => false,
    stdinIsTTY: true,
    stdoutIsTTY: true,
    prompt: async () => "yes",
    ensureAppPaths: (rootDir: string = "/tmp/cloak") => {
      mkdirCalls.push(rootDir, path.join(rootDir, "cookies"), path.join(rootDir, "extensions"));
      return {
        rootDir,
        cookiesDir: path.join(rootDir, "cookies"),
        extensionsDir: path.join(rootDir, "extensions"),
      };
    },
    installRequiredExtension: async (rootDir: string = "/tmp/cloak") => {
      installCalls.push(rootDir);
      return path.join(rootDir, "extensions", "opencli-extension.zip");
    },
    log: () => undefined,
  });

  assert.equal(result.consented, true);
  assert.equal(result.reason, "prompt-accepted");
  assert.equal(result.archivePath, "/tmp/cloak/extensions/opencli-extension.zip");
  assert.deepEqual(mkdirCalls, [
    "/tmp/cloak",
    path.join("/tmp/cloak", "cookies"),
    path.join("/tmp/cloak", "extensions"),
  ]);
  assert.deepEqual(installCalls, ["/tmp/cloak"]);
});

test("bootstrapInstall skips bootstrap when the prompt is declined", async () => {
  const logs: string[] = [];

  const result = await bootstrapInstall("/tmp/cloak", {
    env: {},
    pathExists: () => false,
    stdinIsTTY: true,
    stdoutIsTTY: true,
    prompt: async () => "no",
    ensureAppPaths: () => {
      throw new Error("should not create directories when consent is declined");
    },
    installRequiredExtension: async () => {
      throw new Error("should not install extension when consent is declined");
    },
    log: (message: string) => logs.push(message),
  });

  assert.equal(result.consented, false);
  assert.equal(result.reason, "prompt-declined");
  assert.equal(result.archivePath, undefined);
  assert.equal(logs.at(-1), "cloak did not create /tmp/cloak. Cookies and extension bootstrap were skipped.");
});

test("bootstrapInstall skips bootstrap in non-interactive installs", async () => {
  const logs: string[] = [];

  const result = await bootstrapInstall("/tmp/cloak", {
    pathExists: () => false,
    stdinIsTTY: false,
    stdoutIsTTY: false,
    ensureAppPaths: () => {
      throw new Error("should not create directories in non-interactive installs");
    },
    installRequiredExtension: async () => {
      throw new Error("should not install extension in non-interactive installs");
    },
    log: (message: string) => logs.push(message),
  });

  assert.equal(result.consented, false);
  assert.equal(result.reason, "non-interactive-skipped");
  assert.equal(
    logs[0],
    "Skipping cloak app-home bootstrap because install is non-interactive. Run cloak later to finish setup in /tmp/cloak."
  );
});

test("bootstrapInstall honors CLOAK_INSTALL_CONSENT=yes without prompting", async () => {
  let prompted = false;

  const result = await bootstrapInstall("/tmp/cloak", {
    env: {
      CLOAK_INSTALL_CONSENT: "yes",
    },
    pathExists: () => false,
    prompt: async () => {
      prompted = true;
      return "no";
    },
    ensureAppPaths: (rootDir: string = "/tmp/cloak") => ({
      rootDir,
      cookiesDir: path.join(rootDir, "cookies"),
      extensionsDir: path.join(rootDir, "extensions"),
    }),
    installRequiredExtension: async (rootDir: string = "/tmp/cloak") =>
      path.join(rootDir, "extensions", "opencli-extension.zip"),
    log: () => undefined,
  });

  assert.equal(result.consented, true);
  assert.equal(result.reason, "env-accepted");
  assert.equal(prompted, false);
});

test("bootstrapInstall treats an existing app root as prior consent", async () => {
  let prompted = false;
  let installCalls = 0;

  const result = await bootstrapInstall("/tmp/cloak", {
    env: {},
    pathExists: (targetPath: string) => targetPath === "/tmp/cloak",
    prompt: async () => {
      prompted = true;
      return "no";
    },
    ensureAppPaths: (rootDir: string = "/tmp/cloak") => ({
      rootDir,
      cookiesDir: path.join(rootDir, "cookies"),
      extensionsDir: path.join(rootDir, "extensions"),
    }),
    installRequiredExtension: async (rootDir: string = "/tmp/cloak") => {
      installCalls += 1;
      return path.join(rootDir, "extensions", "opencli-extension.zip");
    },
    log: () => undefined,
  });

  assert.equal(result.consented, true);
  assert.equal(result.reason, "existing-root");
  assert.equal(prompted, false);
  assert.equal(installCalls, 1);
});
