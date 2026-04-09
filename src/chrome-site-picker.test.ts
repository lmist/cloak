import test from "node:test";
import assert from "node:assert/strict";
import {
  clampSelectionIndex,
  filterChromeProfilesForQuery,
  filterChromeSitesForQuery,
} from "./chrome-site-picker.js";

const profiles = [
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
    sites: [{ host: "linear.app", url: "https://linear.app" }],
  },
];

test("filterChromeProfilesForQuery matches directory, profile labels, and site hosts", () => {
  assert.deepEqual(
    filterChromeProfilesForQuery(profiles, "alice").map((profile) => profile.directory),
    ["Profile 1"]
  );
  assert.deepEqual(
    filterChromeProfilesForQuery(profiles, "github").map((profile) => profile.directory),
    ["Default"]
  );
});

test("filterChromeSitesForQuery narrows the site list", () => {
  assert.deepEqual(
    filterChromeSitesForQuery(profiles[0].sites, "git"),
    [{ host: "github.com", url: "https://github.com" }]
  );
});

test("clampSelectionIndex constrains indexes to the available range", () => {
  assert.equal(clampSelectionIndex(-1, 3), 0);
  assert.equal(clampSelectionIndex(8, 3), 2);
  assert.equal(clampSelectionIndex(3, 0), 0);
});
