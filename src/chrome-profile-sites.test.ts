import test from "node:test";
import assert from "node:assert/strict";
import {
  CHROME_PROFILE_SITE_DISCOVERY_MISSING_ERROR,
  coerceChromeProfileSiteDiscoveryError,
  formatChromeProfileSitesReport,
  listChromeProfileSites,
  normalizeCookieHosts,
  resolveChromeCookiesDatabasePath,
  siteHostToUrl,
} from "./chrome-profile-sites.js";

test("normalizeCookieHosts strips leading dots, dedupes, and sorts hosts", () => {
  assert.deepEqual(
    normalizeCookieHosts([".X.com", "github.com", "x.com", "", "  .github.com  "]),
    ["github.com", "x.com"]
  );
});

test("siteHostToUrl prefers http for localhost and IP literals", () => {
  assert.equal(siteHostToUrl("localhost"), "http://localhost");
  assert.equal(siteHostToUrl("127.0.0.1"), "http://127.0.0.1");
  assert.equal(siteHostToUrl("x.com"), "https://x.com");
});

test("resolveChromeCookiesDatabasePath prefers the Network/Cookies database", () => {
  const seenPaths: string[] = [];

  const result = resolveChromeCookiesDatabasePath(
    {
      chromeUserDataDir: "/chrome",
      profileDirectory: "Default",
    },
    {
      pathExists: (targetPath: string) => {
        seenPaths.push(targetPath);
        return targetPath === "/chrome/Default/Network/Cookies";
      },
    }
  );

  assert.equal(result, "/chrome/Default/Network/Cookies");
  assert.deepEqual(seenPaths, ["/chrome/Default/Network/Cookies"]);
});

test("listChromeProfileSites joins profile metadata with discovered cookie hosts", async () => {
  const profiles = await listChromeProfileSites({
    chromeUserDataDir: "/chrome",
    listProfiles: () => [
      { directory: "Default", name: "Main" },
      { directory: "Profile 1", name: "Work", accountName: "Alice Smith" },
    ],
    readCookieHosts: async ({ profileDirectory }) => {
      if (profileDirectory === "Default") {
        return ["github.com", "x.com"];
      }

      return ["localhost"];
    },
  });

  assert.deepEqual(profiles, [
    {
      directory: "Default",
      name: "Main",
      sites: [
        { host: "github.com", url: "https://github.com" },
        { host: "x.com", url: "https://x.com" },
      ],
    },
    {
      directory: "Profile 1",
      name: "Work",
      accountName: "Alice Smith",
      sites: [{ host: "localhost", url: "http://localhost" }],
    },
  ]);
});

test("formatChromeProfileSitesReport groups sites under each profile", () => {
  const report = formatChromeProfileSitesReport([
    {
      directory: "Default",
      name: "Main",
      sites: [{ host: "github.com", url: "https://github.com" }],
    },
    {
      directory: "Profile 1",
      name: "Work",
      accountName: "Alice Smith",
      sites: [],
    },
  ]);

  assert.match(report, /^Default: Main \(1 site\)$/m);
  assert.match(report, /^  github\.com$/m);
  assert.match(report, /^Profile 1: Alice Smith \(0 sites\)$/m);
  assert.match(report, /^\s+\(no cookie-bearing sites found\)$/m);
});

test("coerceChromeProfileSiteDiscoveryError turns missing sqlite3 errors into a clear message", () => {
  const error = coerceChromeProfileSiteDiscoveryError(
    Object.assign(new Error("missing"), { code: "MODULE_NOT_FOUND" })
  );

  assert.equal(error?.message, CHROME_PROFILE_SITE_DISCOVERY_MISSING_ERROR);
});

test("coerceChromeProfileSiteDiscoveryError ignores unrelated errors", () => {
  const error = coerceChromeProfileSiteDiscoveryError(
    Object.assign(new Error("boom"), { code: "EACCES" })
  );

  assert.equal(error, undefined);
});
