import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { defaultAppRootDir, resolveAppPaths } from "./app-paths.js";

test("defaultAppRootDir resolves to ~/.cache/cloak", () => {
  assert.equal(
    defaultAppRootDir({
      homedir: () => "/Users/tester",
    }),
    path.join("/Users/tester", ".cache", "cloak")
  );
});

test("resolveAppPaths uses the cache root as the extension cache directory", () => {
  assert.deepEqual(resolveAppPaths("/tmp/cloak"), {
    extensionsDir: "/tmp/cloak",
  });
});
