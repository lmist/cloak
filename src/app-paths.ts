import os from "node:os";
import path from "node:path";

export type AppPaths = {
  extensionsDir: string;
};

export function defaultAppRootDir(
  dependencies: {
    homedir?: () => string;
  } = {}
): string {
  const homedir = dependencies.homedir ?? os.homedir;
  return path.join(homedir(), ".cache", "cloak");
}

export function resolveAppPaths(rootDir: string = defaultAppRootDir()): AppPaths {
  return {
    extensionsDir: rootDir,
  };
}
