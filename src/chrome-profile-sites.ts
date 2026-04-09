import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {
  defaultChromeUserDataDir,
  listChromeProfiles,
  type ChromeProfile,
} from "./chrome-profiles.js";

type QueryRow = {
  host_key: string | null;
};

export const CHROME_PROFILE_SITE_DISCOVERY_MISSING_ERROR =
  "Chrome profile site discovery is not available in this install. Reinstall cloak in an environment where the optional sqlite3 dependency can be installed successfully.";

type ReadCookieHostsDependencies = {
  chromeUserDataDir?: string;
  pathExists?: (targetPath: string) => boolean;
  makeTempDir?: (prefix: string) => string;
  copyFile?: (sourcePath: string, targetPath: string) => void;
  removeDir?: (targetPath: string, options: { recursive: true; force: true }) => void;
  queryHosts?: (databasePath: string) => Promise<string[]>;
};

type ListChromeProfileSitesDependencies = {
  chromeUserDataDir?: string;
  listProfiles?: typeof listChromeProfiles;
  readCookieHosts?: (
    options: { chromeUserDataDir: string; profileDirectory: string },
    dependencies?: ReadCookieHostsDependencies
  ) => Promise<string[]>;
};

export type ChromeSite = {
  host: string;
  url: string;
};

export type ChromeProfileSites = ChromeProfile & {
  sites: ChromeSite[];
};

export function normalizeCookieHosts(hosts: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const host of hosts) {
    const candidate = host.trim().toLowerCase().replace(/^\.+/, "");

    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized.sort((left, right) => left.localeCompare(right));
}

export function siteHostToUrl(host: string): string {
  const ipCandidate =
    host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const protocol =
    host === "localhost" || net.isIP(ipCandidate) !== 0 ? "http" : "https";

  return `${protocol}://${host}`;
}

export function resolveChromeCookiesDatabasePath(
  options: {
    chromeUserDataDir: string;
    profileDirectory: string;
  },
  dependencies: {
    pathExists?: (targetPath: string) => boolean;
  } = {}
): string | undefined {
  const pathExists = dependencies.pathExists ?? fs.existsSync;
  const profileDir = path.join(options.chromeUserDataDir, options.profileDirectory);
  const candidates = [
    path.join(profileDir, "Network", "Cookies"),
    path.join(profileDir, "Cookies"),
  ];

  return candidates.find((candidate) => pathExists(candidate));
}

async function readCookieHostsForChromeProfile(
  options: {
    chromeUserDataDir: string;
    profileDirectory: string;
  },
  dependencies: ReadCookieHostsDependencies = {}
): Promise<string[]> {
  const pathExists = dependencies.pathExists ?? fs.existsSync;
  const makeTempDir = dependencies.makeTempDir ?? fs.mkdtempSync;
  const copyFile = dependencies.copyFile ?? fs.copyFileSync;
  const removeDir = dependencies.removeDir ?? fs.rmSync;
  const queryHosts = dependencies.queryHosts ?? queryDistinctCookieHosts;
  const sourcePath = resolveChromeCookiesDatabasePath(options, {
    pathExists,
  });

  if (!sourcePath) {
    return [];
  }

  const tempRoot = makeTempDir(path.join(os.tmpdir(), "cloak-cookie-db-"));
  const stagedPath = path.join(tempRoot, path.basename(sourcePath));

  try {
    copyFile(sourcePath, stagedPath);
    copyOptionalSidecar(`${sourcePath}-wal`, `${stagedPath}-wal`, pathExists, copyFile);
    copyOptionalSidecar(`${sourcePath}-shm`, `${stagedPath}-shm`, pathExists, copyFile);

    const hosts = await queryHosts(stagedPath);
    return normalizeCookieHosts(hosts);
  } catch (error) {
    const supportError = coerceChromeProfileSiteDiscoveryError(error);
    if (supportError) {
      throw supportError;
    }

    return [];
  } finally {
    removeDir(tempRoot, { recursive: true, force: true });
  }
}

export async function listChromeProfileSites(
  dependencies: ListChromeProfileSitesDependencies = {}
): Promise<ChromeProfileSites[]> {
  const chromeUserDataDir =
    dependencies.chromeUserDataDir ?? defaultChromeUserDataDir();
  const listProfiles = dependencies.listProfiles ?? listChromeProfiles;
  const readCookieHosts =
    dependencies.readCookieHosts ?? readCookieHostsForChromeProfile;
  const profiles = listProfiles({ chromeUserDataDir });

  return Promise.all(
    profiles.map(async (profile) => {
      const hosts = await readCookieHosts(
        {
          chromeUserDataDir,
          profileDirectory: profile.directory,
        },
        {
          chromeUserDataDir,
        }
      );

      return {
        ...profile,
        sites: hosts.map((host) => ({
          host,
          url: siteHostToUrl(host),
        })),
      };
    })
  );
}

export function formatChromeProfileSitesReport(
  profiles: ChromeProfileSites[]
): string {
  if (profiles.length === 0) {
    return "No Chrome profiles found.\n";
  }

  const lines: string[] = [];

  for (const profile of profiles) {
    const label = profile.accountName ?? profile.name;
    const countLabel = `${profile.sites.length} ${profile.sites.length === 1 ? "site" : "sites"}`;
    lines.push(`${profile.directory}: ${label} (${countLabel})`);

    if (profile.sites.length === 0) {
      lines.push("  (no cookie-bearing sites found)");
    } else {
      for (const site of profile.sites) {
        lines.push(`  ${site.host}`);
      }
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function copyOptionalSidecar(
  sourcePath: string,
  targetPath: string,
  pathExists: (targetPath: string) => boolean,
  copyFile: (sourcePath: string, targetPath: string) => void
) {
  if (!pathExists(sourcePath)) {
    return;
  }

  copyFile(sourcePath, targetPath);
}

async function queryDistinctCookieHosts(databasePath: string): Promise<string[]> {
  const sqlite3 = loadSqlite3();

  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(
      databasePath,
      sqlite3.OPEN_READONLY,
      (openError: Error | null) => {
        if (openError) {
          reject(openError);
          return;
        }

        database.all(
          [
            "SELECT DISTINCT host_key",
            "FROM cookies",
            "WHERE host_key IS NOT NULL AND host_key != ''",
            "ORDER BY host_key COLLATE NOCASE",
          ].join(" "),
          (queryError: Error | null, rows: QueryRow[]) => {
            database.close(() => undefined);

            if (queryError) {
              reject(queryError);
              return;
            }

            resolve(
              rows
                .map((row) => row.host_key ?? "")
                .filter((host) => host.length > 0)
            );
          }
        );
      }
    );
  });
}

export function coerceChromeProfileSiteDiscoveryError(error: unknown): Error | undefined {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "MODULE_NOT_FOUND"
  ) {
    return new Error(CHROME_PROFILE_SITE_DISCOVERY_MISSING_ERROR);
  }

  return undefined;
}

function loadSqlite3(): typeof import("sqlite3") {
  try {
    return require("sqlite3") as typeof import("sqlite3");
  } catch (error) {
    const supportError = coerceChromeProfileSiteDiscoveryError(error);
    if (supportError) {
      throw supportError;
    }

    throw error;
  }
}
