import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("package metadata exposes the cloak binary", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve("package.json"), "utf8"),
  ) as {
    name?: string;
    engines?: Record<string, string>;
    bin?: Record<string, string>;
    files?: string[];
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.name, "cloak");
  assert.equal(packageJson.engines?.node, ">=20");
  assert.deepEqual(packageJson.bin, {
    cloak: "dist/main.js",
  });
  assert.deepEqual(packageJson.files, ["dist", "scripts/postinstall.cjs", "README.org"]);
  assert.equal(packageJson.scripts?.postinstall, "node scripts/postinstall.cjs");
  assert.equal(
    packageJson.scripts?.build,
    "tsc --project tsconfig.build.json"
  );
  assert.equal(packageJson.scripts?.prepack, "npm run build");
  assert.equal(packageJson.scripts?.test, "node --import tsx --test src/**/*.test.ts");
  assert.equal(packageJson.scripts?.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts?.start, "node --import tsx src/main.ts");
  assert.ok(packageJson.dependencies?.patchright);
  assert.ok(packageJson.dependencies?.["adm-zip"]);
  assert.ok(packageJson.dependencies?.chalk);
  assert.ok(packageJson.dependencies?.yargs);
  assert.equal(packageJson.dependencies?.commander, undefined);
});

test("main entrypoint preserves a node shebang for the built CLI", () => {
  const mainScript = fs.readFileSync(path.resolve("src/main.ts"), "utf8");

  assert.match(mainScript, /^#!\/usr\/bin\/env node/m);
});

test("package tarball includes the built node entrypoint", () => {
  const npmCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-npm-cache-"));
  execFileSync("npm", ["run", "build"], {
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
  const packOutput = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
  const [{ files }] = JSON.parse(packOutput) as Array<{
    files: Array<{ path: string }>;
  }>;
  const packedPaths = files.map((file) => file.path);

  assert.ok(packedPaths.includes("dist/main.js"));
  assert.ok(packedPaths.includes("scripts/postinstall.cjs"));
  assert.ok(!packedPaths.includes("src/main.ts"));
});

test("readme documents the current Node workflow and CLI surface", () => {
  const readme = fs.readFileSync(path.resolve("README.org"), "utf8");

  assert.match(readme, /^#\+title: cloak$/m);
  assert.match(readme, /git clone https:\/\/github\.com\/lmist\/cloak\.git/);
  assert.match(readme, /npm install/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm install -g @jackwener\/opencli/);
  assert.match(readme, /npx skills add jackwener\/opencli/);
  assert.match(readme, /asks for consent before creating .*~\/\.config\/cloak/);
  assert.match(readme, /If install is non-interactive/);
  assert.match(readme, /npx patchright install chromium/);
  assert.match(readme, /https:\/\/github\.com\/Kaliiiiiiiiii-Vinyzu\/patchright\//);
  assert.match(readme, /https:\/\/github\.com\/jackwener\/opencli/);
  assert.match(readme, /https:\/\/github\.com\/jackwener\/opencli\/releases\/download\/v1\.6\.8\/opencli-extension\.zip/);
  assert.match(readme, /Claude Code or Cursor/);
  assert.match(readme, /adapt to new requests/);
  assert.match(readme, /build or refine adapters/);
  assert.match(readme, /profiles list/);
  assert.match(readme, /\brun\b/);
  assert.match(readme, /--window/);
  assert.match(readme, /~\/\.config\/cloak/);
  assert.match(readme, /https:\/\/x\.com/);
  assert.match(readme, /chrome-profile "Default"/);
  assert.match(readme, /cookies import/);
});
