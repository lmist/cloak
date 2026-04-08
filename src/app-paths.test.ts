import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { defaultAppRootDir, ensureAppPaths, resolveAppPaths } from "./app-paths.js";

test("defaultAppRootDir resolves to ~/.config/cloak", () => {
  assert.equal(
    defaultAppRootDir({
      homedir: () => "/Users/tester",
    }),
    path.join("/Users/tester", ".config", "cloak")
  );
});

test("resolveAppPaths derives cookies and extensions directories from the app root", () => {
  assert.deepEqual(resolveAppPaths("/tmp/cloak"), {
    rootDir: "/tmp/cloak",
    cookiesDir: path.join("/tmp/cloak", "cookies"),
    extensionsDir: path.join("/tmp/cloak", "extensions"),
  });
});

test("ensureAppPaths creates the app root, cookies, and extensions directories", () => {
  const calls: string[] = [];

  const appPaths = ensureAppPaths("/tmp/cloak", {
    makeDir: (targetPath: string) => {
      calls.push(targetPath);
    },
  });

  assert.deepEqual(appPaths, {
    rootDir: "/tmp/cloak",
    cookiesDir: path.join("/tmp/cloak", "cookies"),
    extensionsDir: path.join("/tmp/cloak", "extensions"),
  });
  assert.deepEqual(calls, [
    "/tmp/cloak",
    path.join("/tmp/cloak", "cookies"),
    path.join("/tmp/cloak", "extensions"),
  ]);
});
