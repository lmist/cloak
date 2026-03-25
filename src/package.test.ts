import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("package metadata exposes the hedlis binary", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve("package.json"), "utf8"),
  ) as {
    name?: string;
    bin?: Record<string, string>;
  };

  assert.equal(packageJson.name, "hedlis");
  assert.deepEqual(packageJson.bin, {
    hedlis: "dist/main.js",
  });
});

test("compiled main entrypoint is executable as a node script", () => {
  const mainScript = fs.readFileSync(path.resolve("dist/main.js"), "utf8");

  assert.match(mainScript, /^#!\/usr\/bin\/env node/m);
});
