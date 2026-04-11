import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { CloakStateDb } from "./state-db.js"

function createStateDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-state-db-"))
  const dbPath = path.join(root, "state.sqlite")

  return {
    root,
    db: new CloakStateDb(dbPath),
  }
}

test("CloakStateDb stores the default profile", () => {
  const { db } = createStateDb()

  assert.equal(db.getDefaultProfile(), undefined)
  db.setDefaultProfile("Profile 7")
  assert.equal(db.getDefaultProfile(), "Profile 7")
})

test("CloakStateDb remembers and replaces cookie URLs per profile", () => {
  const { db } = createStateDb()

  assert.deepEqual(
    db.rememberCookieUrls("Profile 7", ["https://x.com", "https://github.com"]),
    ["https://github.com", "https://x.com"]
  )
  assert.deepEqual(db.getRememberedCookieUrls("Profile 7"), [
    "https://github.com",
    "https://x.com",
  ])
  assert.deepEqual(
    db.replaceRememberedCookieUrls("Profile 7", ["https://linear.app"]),
    ["https://linear.app"]
  )
  assert.deepEqual(db.getRememberedCookieUrls("Profile 7"), [
    "https://linear.app",
  ])
})

test("CloakStateDb stores daemon state and the last daemon command", () => {
  const { db } = createStateDb()

  db.setLastDaemonCommand({
    headless: true,
    profile: "Profile 7",
    cookieFile: "/tmp/cookies.json",
    cookieUrls: ["https://x.com"],
  })
  db.setDaemonState({
    pid: 4242,
    headless: true,
    profile: "Profile 7",
    cookieFile: "/tmp/cookies.json",
    cookieUrls: ["https://x.com"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: "/tmp/cloak.log",
  })

  assert.deepEqual(db.getLastDaemonCommand(), {
    headless: true,
    profile: "Profile 7",
    cookieFile: "/tmp/cookies.json",
    cookieUrls: ["https://x.com"],
  })
  assert.deepEqual(db.getDaemonState(), {
    pid: 4242,
    headless: true,
    profile: "Profile 7",
    cookieFile: "/tmp/cookies.json",
    cookieUrls: ["https://x.com"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: "/tmp/cloak.log",
  })

  db.clearDaemonState(1111)
  assert.equal(db.getDaemonState()?.pid, 4242)
  db.clearDaemonState(4242)
  assert.equal(db.getDaemonState(), undefined)
})

test("CloakStateDb migrates daemon state rows created before cookie files existed", () => {
  const { root } = createStateDb()
  const dbPath = path.join(root, "legacy.sqlite")
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string) => {
      exec(sql: string): void
      prepare(sql: string): {
        run(...parameters: unknown[]): unknown
      }
      close(): void
    }
  }
  const database = new DatabaseSync(dbPath)

  database.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE profile_cookie_urls (
      profile TEXT NOT NULL,
      url TEXT NOT NULL,
      PRIMARY KEY (profile, url)
    );

    CREATE TABLE daemon_state (
      slot INTEGER PRIMARY KEY CHECK (slot = 1),
      pid INTEGER NOT NULL,
      profile TEXT,
      cookie_urls TEXT NOT NULL,
      headless INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      log_path TEXT NOT NULL
    );
  `)

  database
    .prepare(
      [
        "INSERT INTO daemon_state",
        "(slot, pid, profile, cookie_urls, headless, started_at, log_path)",
        "VALUES (1, ?, ?, ?, ?, ?, ?)",
      ].join(" ")
    )
    .run(
      5150,
      "Profile 7",
      JSON.stringify(["https://x.com"]),
      1,
      "2026-04-10T10:00:00.000Z",
      "/tmp/cloak.log"
    )
  database.close()

  const migrated = new CloakStateDb(dbPath)

  assert.deepEqual(migrated.getDaemonState(), {
    pid: 5150,
    headless: true,
    profile: "Profile 7",
    cookieFile: undefined,
    cookieUrls: ["https://x.com"],
    startedAt: "2026-04-10T10:00:00.000Z",
    logPath: "/tmp/cloak.log",
  })

  migrated.setDaemonState({
    pid: 5151,
    headless: false,
    profile: undefined,
    cookieFile: "/tmp/cookies.json",
    cookieUrls: [],
    startedAt: "2026-04-11T00:00:00.000Z",
    logPath: "/tmp/cloak-next.log",
  })

  assert.deepEqual(migrated.getDaemonState(), {
    pid: 5151,
    headless: false,
    profile: undefined,
    cookieFile: "/tmp/cookies.json",
    cookieUrls: [],
    startedAt: "2026-04-11T00:00:00.000Z",
    logPath: "/tmp/cloak-next.log",
  })
})
