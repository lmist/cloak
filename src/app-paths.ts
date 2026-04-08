import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export type AppPaths = {
  rootDir: string;
  cookiesDir: string;
  extensionsDir: string;
};

export function defaultAppRootDir(
  dependencies: {
    homedir?: () => string;
  } = {}
): string {
  const homedir = dependencies.homedir ?? os.homedir;
  return path.join(homedir(), ".config", "cloak");
}

export function resolveAppPaths(rootDir: string = defaultAppRootDir()): AppPaths {
  return {
    rootDir,
    cookiesDir: path.join(rootDir, "cookies"),
    extensionsDir: path.join(rootDir, "extensions"),
  };
}

export function ensureAppPaths(
  rootDir: string = defaultAppRootDir(),
  dependencies: {
    makeDir?: (path: string, options: { recursive: true }) => void;
  } = {}
): AppPaths {
  const makeDir = dependencies.makeDir ?? fs.mkdirSync;
  const appPaths = resolveAppPaths(rootDir);

  makeDir(appPaths.rootDir, { recursive: true });
  makeDir(appPaths.cookiesDir, { recursive: true });
  makeDir(appPaths.extensionsDir, { recursive: true });

  return appPaths;
}
