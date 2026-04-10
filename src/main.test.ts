import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { Cookie } from "./cookies.js"
import { resolveAppPaths } from "./app-paths.js"
import { CloakStateDb } from "./state-db.js"
import {
  dedupeCookies,
  main,
  parseSelectionInput,
  resolveStartupCookies,
} from "./main.js"

function createAppPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-main-"))
  return resolveAppPaths(path.join(root, "cache"), path.join(root, "config"))
}

function createLogCollector() {
  const lines: string[] = []

  return {
    lines,
    log: (message: string) => {
      lines.push(message)
    },
  }
}

function fakeContext(options: { addedCookies?: Cookie[][] } = {}) {
  return {
    addCookies: async (cookies: Cookie[]) => {
      options.addedCookies?.push(cookies)
    },
    browser: () => null,
    on: (_event: "close", listener: () => void) => {
      listener()
    },
    close: async () => undefined,
  }
}

test("parseSelectionInput supports blank, all, none, indexes, and ranges", () => {
  assert.equal(parseSelectionInput("", 5), undefined)
  assert.deepEqual(parseSelectionInput("all", 3), [0, 1, 2])
  assert.deepEqual(parseSelectionInput("none", 3), [])
  assert.deepEqual(parseSelectionInput("1, 3-4", 5), [0, 2, 3])
  assert.throws(() => parseSelectionInput("6", 5), /out of range/i)
})

test("dedupeCookies collapses duplicate name/domain/path triples", () => {
  assert.deepEqual(
    dedupeCookies([
      {
        name: "session",
        value: "first",
        domain: ".x.com",
        path: "/",
      },
      {
        name: "session",
        value: "second",
        domain: ".x.com",
        path: "/",
      },
      {
        name: "csrf",
        value: "third",
        domain: ".x.com",
        path: "/",
      },
    ]),
    [
      {
        name: "session",
        value: "second",
        domain: ".x.com",
        path: "/",
      },
      {
        name: "csrf",
        value: "third",
        domain: ".x.com",
        path: "/",
      },
    ]
  )
})

test("resolveStartupCookies loads every requested URL and warns once", async () => {
  const calls: Array<{ url: string; profile?: string }> = []
  const warnings: string[] = []

  const cookies = await resolveStartupCookies(
    {
      profile: "Profile 7",
      cookieUrls: ["https://x.com", "https://github.com"],
    },
    {
      readChromeCookies: async (options) => {
        calls.push(options)
        return [
          {
            name: options.url,
            value: "ok",
            domain: ".example.com",
            path: "/",
          },
        ]
      },
      warn: (message: string) => warnings.push(message),
    }
  )

  assert.deepEqual(calls, [
    { url: "https://x.com", profile: "Profile 7" },
    { url: "https://github.com", profile: "Profile 7" },
  ])
  assert.equal(cookies.length, 2)
  assert.equal(warnings.length, 1)
})

test("main saves the selected profile", async () => {
  const appPaths = createAppPaths()
  const logger = createLogCollector()

  await main(
    ["node", "dist/main.js", "profile", "use", "Profile 7"],
    {
      appPaths,
      log: logger.log,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      confirmCreateConfigDir: async () => true,
      listChromeProfiles: () => [
        { directory: "Profile 7", name: "Work" },
      ],
    }
  )

  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  assert.equal(stateDb.getDefaultProfile(), "Profile 7")
  assert.match(logger.lines[0] ?? "", /saved default profile/i)
})

test("main prints the installed version", async () => {
  const logger = createLogCollector()
  const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
    version: string
  }

  await main(["node", "dist/main.js", "version"], {
    log: logger.log,
  })

  assert.equal(logger.lines[0], packageJson.version)
})

test("main lists Chrome profiles with friendly labels", async () => {
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "profile", "list"], {
    log: logger.log,
    hasChromeUserDataDir: () => true,
    listChromeProfiles: () => [
      { directory: "Default", name: "Person 1", accountName: "Louai Misto" },
      { directory: "Profile 7", name: "fol4vol" },
    ],
  })

  assert.equal(
    logger.lines[0],
    ["Listing profiles for Chrome", "- Default <Louai Misto>", "- Profile 7 <fol4vol>"].join("\n")
  )
})

test("main omits duplicate labels when a profile name matches its directory", async () => {
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "profile", "list"], {
    log: logger.log,
    hasChromeUserDataDir: () => true,
    listChromeProfiles: () => [
      { directory: "Default", name: "Default" },
    ],
  })

  assert.equal(logger.lines[0], ["Listing profiles for Chrome", "- Default"].join("\n"))
})

test("main refuses to list cookies without a saved default profile", async () => {
  const appPaths = createAppPaths()
  const logger = createLogCollector()

  await assert.rejects(
    main(["node", "dist/main.js", "sites", "list", "--no-pager"], {
      appPaths,
      log: logger.log,
    }),
    /No default profile selected/i
  )
})

test("main lists cookie URLs and remembers an interactive selection", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDefaultProfile("Profile 7")
  const logger = createLogCollector()

  await main(
    ["node", "dist/main.js", "sites", "list"],
    {
      appPaths,
      log: logger.log,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      listChromeProfiles: () => [
        { directory: "Profile 7", name: "Work" },
      ],
      listChromeProfileCookieUrls: async () => [
        "https://x.com",
        "https://github.com",
      ],
      selectCookieUrls: async () => ["https://x.com"],
    }
  )

  assert.match(logger.lines[0] ?? "", /Cookie URLs for Profile 7/)
  assert.match(logger.lines[1] ?? "", /Saved 1 cookie URL/i)
  assert.deepEqual(stateDb.getRememberedCookieUrls("Profile 7"), [
    "https://x.com",
  ])
})

test("main run uses the default profile and remembered cookie URLs", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDefaultProfile("Profile 7")
  stateDb.rememberCookieUrls("Profile 7", ["https://x.com"])
  const logger = createLogCollector()
  const addedCookies: Cookie[][] = []
  const cookieCalls: Array<{ url: string; profile?: string }> = []

  await main(["node", "dist/main.js", "run"], {
    appPaths,
    log: logger.log,
    listChromeProfiles: () => [
      { directory: "Profile 7", name: "Work" },
    ],
    readChromeCookies: async (options) => {
      cookieCalls.push(options)
      return [
        {
          name: "session",
          value: "abc",
          domain: ".x.com",
          path: "/",
        },
      ]
    },
    prepareRequiredExtension: async () => "/tmp/opencli-extension",
    makeTempDir: () => "/tmp/cloak-profile",
    makeDir: () => undefined,
    writeFile: () => undefined,
    launchPersistentContext: async () => fakeContext({ addedCookies }),
  })

  assert.match(logger.lines[0] ?? "", /Running with settings/)
  assert.deepEqual(cookieCalls, [
    { url: "https://x.com", profile: "Profile 7" },
  ])
  assert.equal(addedCookies.length, 1)
})

test("main run remembers explicit cookie URLs when asked", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDefaultProfile("Profile 7")
  const logger = createLogCollector()

  await main(
    [
      "node",
      "dist/main.js",
      "run",
      "--persist-cookies",
      "--cookie-url",
      "https://x.com",
    ],
    {
      appPaths,
      log: logger.log,
      listChromeProfiles: () => [
        { directory: "Profile 7", name: "Work" },
      ],
      readChromeCookies: async () => [
        {
          name: "session",
          value: "abc",
          domain: ".x.com",
          path: "/",
        },
      ],
      prepareRequiredExtension: async () => "/tmp/opencli-extension",
      makeTempDir: () => "/tmp/cloak-profile",
      makeDir: () => undefined,
      writeFile: () => undefined,
      launchPersistentContext: async () => fakeContext(),
    }
  )

  assert.deepEqual(stateDb.getRememberedCookieUrls("Profile 7"), [
    "https://x.com/",
  ])
  assert.match(logger.lines[1] ?? "", /Remembered 1 cookie URL/i)
})

test("main run in daemon mode stores daemon state", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDefaultProfile("Profile 7")
  const logger = createLogCollector()

  await main(
    [
      "node",
      "dist/main.js",
      "daemon",
      "start",
      "--persist-cookies",
      "--cookie-url",
      "https://x.com",
    ],
    {
      appPaths,
      log: logger.log,
      listChromeProfiles: () => [
        { directory: "Profile 7", name: "Work" },
      ],
      spawnDaemonProcess: () => 4242,
      now: () => new Date("2026-04-10T10:00:00.000Z"),
    }
  )

  assert.match(logger.lines.at(-1) ?? "", /Started cloak daemon \(4242\)/)
  assert.equal(fs.existsSync(path.dirname(appPaths.daemonLogPath)), true)
  assert.deepEqual(stateDb.getRememberedCookieUrls("Profile 7"), [
    "https://x.com/",
  ])
  assert.deepEqual(stateDb.getDaemonState(), {
    pid: 4242,
    headless: true,
    profile: "Profile 7",
    cookieUrls: ["https://x.com/"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: appPaths.daemonLogPath,
  })
})

test("main daemon status reports the active daemon", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDaemonState({
    pid: 4242,
    headless: true,
    profile: "Profile 7",
    cookieUrls: ["https://x.com"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: appPaths.daemonLogPath,
  })
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "daemon", "status"], {
    appPaths,
    log: logger.log,
    isProcessRunning: () => true,
  })

  assert.match(logger.lines[0] ?? "", /pid: 4242/)
  assert.match(logger.lines[0] ?? "", /status: running/)
})

test("main daemon logs prints the cached daemon log", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(path.dirname(appPaths.daemonLogPath), { recursive: true })
  fs.writeFileSync(appPaths.daemonLogPath, "line 1\nline 2\n")
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "daemon", "logs"], {
    appPaths,
    log: logger.log,
  })

  assert.equal(logger.lines[0], "line 1\nline 2")
})

test("main daemon logs reports when no cached log exists", async () => {
  const appPaths = createAppPaths()
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "daemon", "logs"], {
    appPaths,
    log: logger.log,
  })

  assert.match(logger.lines[0] ?? "", /No daemon log found/i)
  assert.match(logger.lines[0] ?? "", new RegExp(appPaths.daemonLogPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
})

test("main storage show reports the sqlite path and current state summary", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDefaultProfile("Profile 7")
  stateDb.setDaemonState({
    pid: 4242,
    headless: true,
    profile: "Profile 7",
    cookieUrls: ["https://x.com"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: appPaths.daemonLogPath,
  })
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "storage", "show"], {
    appPaths,
    log: logger.log,
    isProcessRunning: () => true,
  })

  assert.match(logger.lines[0] ?? "", new RegExp(appPaths.stateDbPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(logger.lines[0] ?? "", /default profile: Profile 7/)
  assert.match(logger.lines[0] ?? "", /daemon: running \(4242\)/)
})

test("main daemon stop clears the saved daemon state", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDaemonState({
    pid: 4242,
    headless: true,
    profile: "Profile 7",
    cookieUrls: ["https://x.com"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: appPaths.daemonLogPath,
  })
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "daemon", "stop"], {
    appPaths,
    log: logger.log,
    isProcessRunning: () => true,
    stopProcess: async () => true,
  })

  assert.equal(stateDb.getDaemonState(), undefined)
  assert.match(logger.lines[0] ?? "", /Stopped cloak daemon/i)
})

test("main storage destroy confirms, stops the daemon, and removes the config dir", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  fs.mkdirSync(path.dirname(appPaths.daemonLogPath), { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setDaemonState({
    pid: 4242,
    headless: true,
    profile: "Profile 7",
    cookieUrls: ["https://x.com"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: appPaths.daemonLogPath,
  })
  fs.writeFileSync(appPaths.daemonLogPath, "log\n")
  const logger = createLogCollector()
  const stoppedPids: number[] = []

  await main(["node", "dist/main.js", "storage", "destroy"], {
    appPaths,
    log: logger.log,
    stdinIsTTY: true,
    stdoutIsTTY: true,
    confirmDestroyState: async () => true,
    isProcessRunning: () => true,
    stopProcess: async (pid: number) => {
      stoppedPids.push(pid)
      return true
    },
  })

  assert.deepEqual(stoppedPids, [4242])
  assert.equal(fs.existsSync(appPaths.configDir), false)
  assert.match(logger.lines[0] ?? "", /Destroyed cloak storage under/)
})

test("main daemon restart reuses the last daemon command", async () => {
  const appPaths = createAppPaths()
  fs.mkdirSync(appPaths.configDir, { recursive: true })
  const stateDb = new CloakStateDb(appPaths.stateDbPath)
  stateDb.setLastDaemonCommand({
    headless: true,
    profile: "Profile 7",
    cookieUrls: ["https://x.com"],
  })
  const logger = createLogCollector()

  await main(["node", "dist/main.js", "daemon", "restart"], {
    appPaths,
    log: logger.log,
    spawnDaemonProcess: () => 5150,
    now: () => new Date("2026-04-10T12:00:00.000Z"),
  })

  assert.match(logger.lines[0] ?? "", /Started cloak daemon \(5150\)/)
  assert.equal(stateDb.getDaemonState()?.pid, 5150)
})
