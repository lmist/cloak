import fs from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  defaultAppRootDir,
  ensureAppPaths,
  resolveAppPaths,
  type AppPaths,
} from "./app-paths.js";
import { installRequiredExtension } from "./extension.js";
import { formatInfo } from "./output.js";

type InstallConsentReason =
  | "existing-root"
  | "env-accepted"
  | "prompt-accepted"
  | "env-declined"
  | "prompt-declined"
  | "non-interactive-skipped";

type BootstrapInstallDependencies = {
  env?: NodeJS.ProcessEnv;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  pathExists?: (path: string) => boolean;
  ensureAppPaths?: typeof ensureAppPaths;
  installRequiredExtension?: typeof installRequiredExtension;
  prompt?: (message: string) => Promise<string>;
  log?: (message: string) => void;
};

export type BootstrapInstallResult = {
  appPaths: AppPaths;
  reason: InstallConsentReason;
  consented: boolean;
  archivePath?: string;
};

function normalizeConsent(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["y", "yes", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["n", "no", "false", "0"].includes(normalized)) {
    return false;
  }

  return undefined;
}

async function askForInstallConsent(
  appRootDir: string,
  dependencies: BootstrapInstallDependencies
): Promise<{ consented: boolean; reason: InstallConsentReason }> {
  const env = dependencies.env ?? process.env;
  const log = dependencies.log ?? ((message: string) => console.log(formatInfo(message)));
  const envConsent = normalizeConsent(env.CLOAK_INSTALL_CONSENT);

  if (envConsent === true) {
    return {
      consented: true,
      reason: "env-accepted",
    };
  }

  if (envConsent === false) {
    return {
      consented: false,
      reason: "env-declined",
    };
  }

  const stdinIsTTY = dependencies.stdinIsTTY ?? stdin.isTTY ?? false;
  const stdoutIsTTY = dependencies.stdoutIsTTY ?? stdout.isTTY ?? false;

  if (!stdinIsTTY || !stdoutIsTTY || env.CI) {
    log(
      `Skipping cloak app-home bootstrap because install is non-interactive. Run cloak later to finish setup in ${appRootDir}.`
    );
    return {
      consented: false,
      reason: "non-interactive-skipped",
    };
  }

  const prompt =
    dependencies.prompt ??
    (async (message: string) => {
      const readline = createInterface({
        input: stdin,
        output: stdout,
      });

      try {
        return await readline.question(message);
      } finally {
        readline.close();
      }
    });

  const answer = await prompt(
    [
      "cloak stores runtime data outside the install directory.",
      `Create ${appRootDir} now?`,
      "This will prepare cookies/, extensions/, and download the pinned OpenCLI extension archive.",
      "Continue? [y/N] ",
    ].join("\n")
  );

  return normalizeConsent(answer)
    ? {
        consented: true,
        reason: "prompt-accepted",
      }
    : {
        consented: false,
        reason: "prompt-declined",
      };
}

export async function bootstrapInstall(
  rootDir: string = defaultAppRootDir(),
  dependencies: BootstrapInstallDependencies = {}
): Promise<BootstrapInstallResult> {
  const appPaths = resolveAppPaths(rootDir);
  const pathExists = dependencies.pathExists ?? fs.existsSync;
  const log = dependencies.log ?? ((message: string) => console.log(formatInfo(message)));
  const ensurePaths = dependencies.ensureAppPaths ?? ensureAppPaths;
  const installExtension =
    dependencies.installRequiredExtension ?? installRequiredExtension;

  if (pathExists(appPaths.rootDir)) {
    ensurePaths(rootDir);
    const archivePath = await installExtension(rootDir);
    return {
      appPaths,
      archivePath,
      consented: true,
      reason: "existing-root",
    };
  }

  const consent = await askForInstallConsent(appPaths.rootDir, dependencies);

  if (!consent.consented) {
    log(
      `cloak did not create ${appPaths.rootDir}. Cookies and extension bootstrap were skipped.`
    );
    return {
      appPaths,
      consented: false,
      reason: consent.reason,
    };
  }

  ensurePaths(rootDir);
  const archivePath = await installExtension(rootDir);
  log(`Prepared cloak app home at ${appPaths.rootDir}`);

  return {
    appPaths,
    archivePath,
    consented: true,
    reason: consent.reason,
  };
}
