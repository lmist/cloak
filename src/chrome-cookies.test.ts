import test from "node:test"
import assert from "node:assert/strict"
import { createCipheriv, createHash, pbkdf2Sync } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  CHROME_COOKIE_APP_BOUND_UNSUPPORTED_ERROR,
  candidateChromeCookieHosts,
  createChromeCookieReader,
  readChromeCookies,
} from "./chrome-cookies.js"

const POSIX_SALT = "saltysalt"
const POSIX_IV = Buffer.from(" ".repeat(16), "utf8")

function createReaderDependencies(overrides: Record<string, unknown> = {}) {
  return {
    chromeUserDataDir: "/Users/example/Library/Application Support/Google/Chrome",
    pathExists: () => true,
    makeTempDir: () => "/tmp/cloak-cookie-db",
    copyFile: () => undefined,
    removeDir: () => undefined,
    ...overrides,
  }
}

function encryptPosixCookieValue(
  value: string,
  options: {
    hostKey: string
    password: string
    iterations: number
    version?: "v10" | "v11"
  }
): Uint8Array {
  const key = pbkdf2Sync(
    options.password,
    POSIX_SALT,
    options.iterations,
    16,
    "sha1"
  )
  const cipher = createCipheriv("aes-128-cbc", key, POSIX_IV)
  const payload = Buffer.concat([
    createHash("sha256").update(options.hostKey).digest(),
    Buffer.from(value, "utf8"),
  ])

  return Buffer.concat([
    Buffer.from(options.version ?? "v10", "utf8"),
    cipher.update(payload),
    cipher.final(),
  ])
}

function encryptWindowsCookieValue(
  value: string,
  options: {
    hostKey: string
    key: Buffer
    version?: "v10"
  }
): Uint8Array {
  const nonce = Buffer.from("123456789012", "utf8")
  const cipher = createCipheriv("aes-256-gcm", options.key, nonce)
  const payload = Buffer.concat([
    createHash("sha256").update(options.hostKey).digest(),
    Buffer.from(value, "utf8"),
  ])
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([
    Buffer.from(options.version ?? "v10", "utf8"),
    nonce,
    ciphertext,
    authTag,
  ])
}

test("readChromeCookies passes the requested URL to the injected reader", async () => {
  const calls: Array<[string, string, string | undefined]> = []
  const getCookies = async (url: string, format: string, profile?: string) => {
    calls.push([url, format, profile])
    return []
  }

  await readChromeCookies({ url: "https://x.com" }, getCookies)

  assert.deepEqual(calls, [["https://x.com", "puppeteer", undefined]])
})

test("readChromeCookies passes the Chrome profile through to the injected reader", async () => {
  const calls: Array<[string, string, string | undefined]> = []
  const getCookies = async (url: string, format: string, profile?: string) => {
    calls.push([url, format, profile])
    return []
  }

  await readChromeCookies(
    { url: "https://x.com", profile: "Profile 2" },
    getCookies
  )

  assert.deepEqual(calls, [["https://x.com", "puppeteer", "Profile 2"]])
})

test("readChromeCookies normalizes persistent, expired, and session puppeteer cookies", async () => {
  const cookies = await readChromeCookies(
    { url: "https://x.com" },
    async () => [
      {
        name: "sessionid",
        value: "abc123",
        domain: ".x.com",
        path: "/",
        expires: 11644473602500000,
        HttpOnly: true,
        Secure: true,
      },
      {
        name: "expired",
        value: "ghi789",
        domain: ".x.com",
        path: "/",
        expires: 11644473599000000,
      },
      {
        name: "csrftoken",
        value: "def456",
        domain: ".x.com",
        path: "/",
        expires: 0,
        HttpOnly: true,
      },
    ]
  )

  assert.deepEqual(cookies, [
    {
      name: "sessionid",
      value: "abc123",
      domain: ".x.com",
      path: "/",
      expires: 2,
      httpOnly: true,
      secure: true,
    },
    {
      name: "expired",
      value: "ghi789",
      domain: ".x.com",
      path: "/",
      expires: -1,
    },
    {
      name: "csrftoken",
      value: "def456",
      domain: ".x.com",
      path: "/",
      httpOnly: true,
    },
  ])
})

test("candidateChromeCookieHosts includes exact and parent-domain keys", () => {
  assert.deepEqual(candidateChromeCookieHosts("www.example.com"), [
    "www.example.com",
    ".www.example.com",
    "example.com",
    ".example.com",
    "com",
    ".com",
  ])
})

test("createChromeCookieReader preserves distinct matching cookies on macOS", async () => {
  const password = "mac-safe-storage"
  const queryCalls: string[][] = []
  const reader = createChromeCookieReader(
    createReaderDependencies({
      platform: "darwin",
      runCommand: (command: string) => {
        assert.equal(command, "security")
        return `${password}\n`
      },
      queryRows: (_databasePath: string, hostKeys: string[]) => {
        queryCalls.push(hostKeys)

        return [
          {
            host_key: ".example.com",
            path: "/account",
            is_secure: 1,
            expires_utc: 11644473602000000n,
            name: "session",
            value: "",
            encrypted_value: encryptPosixCookieValue("account-cookie", {
              hostKey: ".example.com",
              password,
              iterations: 1003,
            }),
            creation_utc: 10n,
            is_httponly: 1,
            samesite: 1,
          },
          {
            host_key: ".example.com",
            path: "/",
            is_secure: 1,
            expires_utc: 11644473603000000n,
            name: "session",
            value: "",
            encrypted_value: encryptPosixCookieValue("root-cookie", {
              hostKey: ".example.com",
              password,
              iterations: 1003,
            }),
            creation_utc: 11n,
            is_httponly: 0,
            samesite: 2,
          },
          {
            host_key: "www.example.com",
            path: "/",
            is_secure: 0,
            expires_utc: 0n,
            name: "host-only",
            value: "plain-host-cookie",
            encrypted_value: null,
            creation_utc: 12n,
            is_httponly: 0,
            samesite: -1,
          },
          {
            host_key: ".example.com",
            path: "/admin",
            is_secure: 1,
            expires_utc: 11644473604000000n,
            name: "admin",
            value: "",
            encrypted_value: encryptPosixCookieValue("admin-cookie", {
              hostKey: ".example.com",
              password,
              iterations: 1003,
            }),
            creation_utc: 13n,
            is_httponly: 0,
            samesite: 0,
          },
        ]
      },
    })
  )

  const cookies = await readChromeCookies(
    {
      url: "https://www.example.com/account/settings",
      profile: "Profile 7",
    },
    reader
  )

  assert.deepEqual(queryCalls, [[
    "www.example.com",
    ".www.example.com",
    "example.com",
    ".example.com",
    "com",
    ".com",
  ]])
  assert.deepEqual(cookies, [
    {
      name: "session",
      value: "account-cookie",
      domain: ".example.com",
      path: "/account",
      expires: 2,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "session",
      value: "root-cookie",
      domain: ".example.com",
      path: "/",
      expires: 3,
      secure: true,
      sameSite: "Strict",
    },
    {
      name: "host-only",
      value: "plain-host-cookie",
      domain: "www.example.com",
      path: "/",
    },
  ])
})

test("createChromeCookieReader decrypts Windows AES-GCM cookies with the Local State key", async () => {
  const rawKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf8")
  const reader = createChromeCookieReader(
    createReaderDependencies({
      platform: "win32",
      readFile: () =>
        JSON.stringify({
          os_crypt: {
            encrypted_key: Buffer.concat([
              Buffer.from("DPAPI", "utf8"),
              Buffer.from("wrapped-key", "utf8"),
            ]).toString("base64"),
          },
        }),
      runCommand: (command: string) => {
        assert.match(command, /powershell/i)
        return rawKey.toString("base64")
      },
      queryRows: () => [
        {
          host_key: ".example.com",
          path: "/",
          is_secure: 1,
          expires_utc: 11644473602000000n,
          name: "session",
          value: "",
          encrypted_value: encryptWindowsCookieValue("windows-cookie", {
            hostKey: ".example.com",
            key: rawKey,
          }),
          creation_utc: 10n,
          is_httponly: 1,
          samesite: 0,
        },
      ],
    })
  )

  const cookies = await readChromeCookies(
    {
      url: "https://app.example.com/",
    },
    reader
  )

  assert.deepEqual(cookies, [
    {
      name: "session",
      value: "windows-cookie",
      domain: ".example.com",
      path: "/",
      expires: 2,
      httpOnly: true,
      secure: true,
      sameSite: "None",
    },
  ])
})

test("createChromeCookieReader rejects Windows app-bound cookie encryption", async () => {
  const reader = createChromeCookieReader(
    createReaderDependencies({
      platform: "win32",
      queryRows: () => [
        {
          host_key: ".example.com",
          path: "/",
          is_secure: 1,
          expires_utc: 11644473602000000n,
          name: "session",
          value: "",
          encrypted_value: Buffer.from("v20still-nope", "utf8"),
          creation_utc: 10n,
          is_httponly: 1,
          samesite: 0,
        },
      ],
    })
  )

  await assert.rejects(
    readChromeCookies(
      {
        url: "https://app.example.com/",
      },
      reader
    ),
    new RegExp(CHROME_COOKIE_APP_BOUND_UNSUPPORTED_ERROR)
  )
})

test("readChromeCookies reads large Chromium integer timestamps through node:sqlite", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cloak-cookie-reader-"))
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const chromeUserDataDir = path.join(root, "Chrome")
  const profileDir = path.join(chromeUserDataDir, "Profile 7", "Network")
  const cookieDbPath = path.join(profileDir, "Cookies")
  fs.mkdirSync(profileDir, { recursive: true })

  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (targetPath: string) => {
      close(): void
      exec(sql: string): void
    }
  }
  const database = new DatabaseSync(cookieDbPath)

  try {
    database.exec(
      [
        "CREATE TABLE cookies (",
        "host_key TEXT NOT NULL,",
        "path TEXT NOT NULL,",
        "is_secure INTEGER NOT NULL,",
        "expires_utc INTEGER NOT NULL,",
        "name TEXT NOT NULL,",
        "value TEXT NOT NULL,",
        "encrypted_value BLOB,",
        "creation_utc INTEGER NOT NULL,",
        "is_httponly INTEGER NOT NULL,",
        "samesite INTEGER",
        ");",
        "INSERT INTO cookies VALUES ('.instagram.com', '/', 1, 13450300143471040, 'datr', 'cookie-value', NULL, 1, 1, 1);",
        "INSERT INTO cookies VALUES ('.instagram.com', '/', 1, 0, 'sessionid', 'session-value', NULL, 2, 0, -1);",
      ].join(" ")
    )
  } finally {
    database.close()
  }

  const cookies = await readChromeCookies(
    {
      url: "https://instagram.com",
      profile: "Profile 7",
    },
    createChromeCookieReader({
      chromeUserDataDir,
    })
  )

  assert.deepEqual(cookies, [
    {
      name: "datr",
      value: "cookie-value",
      domain: ".instagram.com",
      path: "/",
      expires: 1805826543,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "sessionid",
      value: "session-value",
      domain: ".instagram.com",
      path: "/",
      secure: true,
    },
  ])
})
