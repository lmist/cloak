import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { isHeadlessEnabled, parseCli } from "./cli.js"

function runInlineScript(script: string) {
  return spawnSync("node", ["--import", "tsx", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

test("parseCli shows canonical help mode with no legacy commands", () => {
  const cli = parseCli(["node", "dist/main.js"])

  assert.equal(cli.mode, "help")
  assert.match(cli.text, /Usage:\s+cloak <command>/i)
  assert.match(cli.text, /cloak daemon start/i)
  assert.match(cli.text, /cloak daemon status/i)
  assert.match(cli.text, /cloak profile list/i)
  assert.match(cli.text, /cloak sites list/i)
  assert.match(cli.text, /cloak storage show/i)
  assert.match(cli.text, /cloak version/i)
  assert.doesNotMatch(cli.text, /cloak inspect/i)
  assert.doesNotMatch(cli.text, /cloak stop/i)
  assert.doesNotMatch(cli.text, /cloak restart/i)
  assert.doesNotMatch(cli.text, /cloak profiles\b/i)
  assert.doesNotMatch(cli.text, /cloak cookies list/i)
  assert.doesNotMatch(cli.text, /cloak state\b/i)
})

test("parseCli parses version mode", () => {
  assert.deepEqual(parseCli(["node", "dist/main.js", "version"]), {
    mode: "version",
  })
  assert.deepEqual(parseCli(["node", "dist/main.js", "--version"]), {
    mode: "version",
  })
  assert.deepEqual(parseCli(["node", "dist/main.js", "-v"]), {
    mode: "version",
  })
})

test("parseCli parses run mode with headless enabled by default", () => {
  assert.deepEqual(parseCli(["node", "dist/main.js", "run"]), {
    mode: "run",
    headless: true,
    daemon: false,
    persistCookies: false,
    consent: false,
    profile: undefined,
    cookieUrls: [],
  })
})

test("parseCli parses daemon start with consent profile and cookie URLs", () => {
  assert.deepEqual(
    parseCli([
      "node",
      "dist/main.js",
      "daemon",
      "start",
      "--consent",
      "--persist-cookies",
      "--profile",
      "Profile 7",
      "--cookie-url",
      "https://x.com",
      "--cookie-url",
      "https://github.com",
    ]),
    {
      mode: "run",
      headless: true,
      daemon: true,
      persistCookies: true,
      consent: true,
      profile: "Profile 7",
      cookieUrls: ["https://x.com/", "https://github.com/"],
    }
  )
})

test("parseCli parses daemon status stop restart and logs", () => {
  assert.deepEqual(parseCli(["node", "dist/main.js", "daemon", "status"]), {
    mode: "daemon-status",
  })
  assert.deepEqual(parseCli(["node", "dist/main.js", "daemon", "stop"]), {
    mode: "daemon-stop",
  })
  assert.deepEqual(parseCli(["node", "dist/main.js", "daemon", "restart"]), {
    mode: "daemon-restart",
  })
  assert.deepEqual(parseCli(["node", "dist/main.js", "daemon", "logs"]), {
    mode: "daemon-logs",
  })
})

test("parseCli parses profile commands", () => {
  assert.deepEqual(parseCli(["node", "dist/main.js", "profile", "list"]), {
    mode: "profile-list",
  })
  assert.deepEqual(parseCli(["node", "dist/main.js", "profile", "show"]), {
    mode: "profile-show",
  })
  assert.deepEqual(
    parseCli([
      "node",
      "dist/main.js",
      "profile",
      "use",
      "Profile 7",
      "--consent",
    ]),
    {
      mode: "profile-use",
      profile: "Profile 7",
      consent: true,
    }
  )
})

test("parseCli parses sites list mode", () => {
  assert.deepEqual(
    parseCli([
      "node",
      "dist/main.js",
      "sites",
      "list",
      "--no-pager",
      "--limit",
      "20",
    ]),
    {
      mode: "sites-list",
      limit: 20,
      noPager: true,
      consent: false,
    }
  )
})

test("parseCli parses storage show and destroy", () => {
  assert.deepEqual(parseCli(["node", "dist/main.js", "storage", "show"]), {
    mode: "storage-show",
  })
  assert.deepEqual(parseCli(["node", "dist/main.js", "storage", "destroy"]), {
    mode: "storage-destroy",
  })
})

test("parseCli rejects removed legacy commands and flags", () => {
  assert.throws(
    () => parseCli(["node", "dist/main.js", "inspect"]),
    /unknown|command|arguments/i
  )
  assert.throws(
    () => parseCli(["node", "dist/main.js", "stop"]),
    /unknown|command|arguments/i
  )
  assert.throws(
    () => parseCli(["node", "dist/main.js", "restart"]),
    /unknown|command|arguments/i
  )
  assert.throws(
    () => parseCli(["node", "dist/main.js", "profiles", "status"]),
    /unknown|command|arguments/i
  )
  assert.throws(
    () => parseCli(["node", "dist/main.js", "cookies", "list"]),
    /unknown|command|arguments/i
  )
  assert.throws(
    () => parseCli(["node", "dist/main.js", "state", "display"]),
    /unknown|command|arguments/i
  )
  assert.throws(
    () => parseCli(["node", "dist/main.js", "run", "--daemon"]),
    /unknown|argument/i
  )
})

test("parseCli rejects --persist-cookies without --cookie-url", () => {
  assert.throws(
    () =>
      parseCli([
        "node",
        "dist/main.js",
        "daemon",
        "start",
        "--persist-cookies",
      ]),
    /--persist-cookies requires at least one --cookie-url/i
  )
})

test("parseCli rejects non-http cookie URLs", () => {
  assert.throws(
    () =>
      parseCli([
        "node",
        "dist/main.js",
        "daemon",
        "start",
        "--cookie-url",
        "file:///tmp/cookies.txt",
      ]),
    /invalid url/i
  )
})

test("parseCli rejects invalid limits", () => {
  assert.throws(
    () =>
      parseCli([
        "node",
        "dist/main.js",
        "sites",
        "list",
        "--limit",
        "0",
      ]),
    /positive integer/i
  )
})

test("parseCli rejects the removed browser flag", () => {
  assert.throws(
    () =>
      parseCli([
        "node",
        "dist/main.js",
        "run",
        "--cookies-from-browser",
        "chrome",
      ]),
    /unknown|arguments/i
  )
})

test("parseCli does not write yargs errors to stderr", () => {
  const result = runInlineScript(`
    const { parseCli } = require("./src/cli.ts")
    try {
      parseCli(["node", "src/main.ts", "daemon", "start", "--persist-cookies"])
      process.exit(0)
    } catch {
      process.exit(1)
    }
  `)

  assert.equal(result.status, 1)
  assert.equal(result.stderr, "")
})

test("isHeadlessEnabled returns false for help mode", () => {
  assert.equal(isHeadlessEnabled(["node", "dist/main.js"]), false)
})

test("isHeadlessEnabled returns true for run mode by default", () => {
  assert.equal(isHeadlessEnabled(["node", "dist/main.js", "run"]), true)
})

test("isHeadlessEnabled returns true for daemon start by default", () => {
  assert.equal(isHeadlessEnabled(["node", "dist/main.js", "daemon", "start"]), true)
})

test("isHeadlessEnabled returns false when daemon start uses --window", () => {
  assert.equal(
    isHeadlessEnabled(["node", "dist/main.js", "daemon", "start", "--window"]),
    false
  )
})
