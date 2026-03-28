import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("package metadata exposes the hedlis binary", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve("package.json"), "utf8"),
  ) as {
    name?: string;
    bin?: Record<string, string>;
    files?: string[];
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.name, "hedlis");
  assert.deepEqual(packageJson.bin, {
    hedlis: "dist/main.js",
  });
  assert.deepEqual(packageJson.files, ["dist", "README.md", "usage.md"]);
  assert.equal(packageJson.scripts?.prepare, undefined);
  assert.equal(packageJson.scripts?.build, "tsc && chmod +x dist/main.js");
  assert.ok(packageJson.dependencies?.patchright);
});

test("compiled main entrypoint is executable as a node script", () => {
  const mainScript = fs.readFileSync(path.resolve("dist/main.js"), "utf8");
  const mainScriptMode = fs.statSync(path.resolve("dist/main.js")).mode & 0o777;

  assert.match(mainScript, /^#!\/usr\/bin\/env node/m);
  assert.equal(mainScriptMode & 0o111, 0o111);
});

test("package tarball includes the compiled hedlis entrypoint", () => {
  const packOutput = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
  });
  const packResult = JSON.parse(packOutput) as Array<{
    files?: Array<{ path?: string }>;
  }>;

  assert.ok(
    packResult[0]?.files?.some((file) => file.path === "dist/main.js"),
    "expected npm pack output to include dist/main.js"
  );
});

test("compiled hedlis entrypoint is tracked in git for GitHub installs", () => {
  const trackedPath = execFileSync(
    "git",
    ["ls-files", "--error-unmatch", "dist/main.js"],
    { encoding: "utf8" }
  ).trim();

  assert.equal(trackedPath, "dist/main.js");
});

test("readme documents engine configuration and patchright setup", () => {
  const readme = fs.readFileSync(path.resolve("README.md"), "utf8");

  assert.match(readme, /hedlis config set engine patchright/);
  assert.match(readme, /hedlis config get engine/);
  assert.match(readme, /npx patchright install chromium/);
});
