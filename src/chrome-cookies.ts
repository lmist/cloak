import { execFileSync } from "node:child_process"
import { createDecipheriv, createHash, pbkdf2Sync } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { normalizeCookie, type Cookie } from "./cookies.js"
import { resolveChromeCookiesDatabasePath } from "./chrome-profile-sites.js"
import { defaultChromeUserDataDir } from "./chrome-profiles.js"

export const CHROME_COOKIE_LIMITATION_WARNING =
  "Chrome cookie import is best-effort and only reuses cookies, not the rest of the browser profile. If a login still fails after injection, the site may depend on additional browser state."
export const CHROME_COOKIE_SUPPORT_MISSING_ERROR =
  "Chrome cookie support is not available in this environment. cloak could not access the selected profile's cookie database or the platform secret storage needed to decrypt it."
export const CHROME_COOKIE_APP_BOUND_UNSUPPORTED_ERROR =
  "Chrome app-bound cookie encryption on Windows is not supported by cloak yet."

type ChromePuppeteerCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  HttpOnly?: boolean
  Secure?: boolean
  sameSite?: string
}

type ChromeCookieReader = (
  url: string,
  format: "puppeteer",
  profile?: string
) => Promise<ChromePuppeteerCookie[]>

type ChromeCookieDatabaseRow = {
  host_key: string
  path: string
  is_secure: number | bigint
  expires_utc: number | bigint
  name: string
  value: string
  encrypted_value: Uint8Array | null
  creation_utc: number | bigint
  is_httponly: number | bigint
  samesite: number | bigint | null
}

type StatementLike = {
  all(...parameters: string[]): Array<Record<string, unknown>>
}

type DatabaseLike = {
  prepare(sql: string): StatementLike
  close(): void
}

type DatabaseConstructor = new (
  path: string,
  options?: {
    readOnly?: boolean
  }
) => DatabaseLike

type ChromeCookieReaderDependencies = {
  chromeUserDataDir?: string
  platform?: NodeJS.Platform
  pathExists?: (targetPath: string) => boolean
  makeTempDir?: (prefix: string) => string
  copyFile?: (sourcePath: string, targetPath: string) => void
  removeDir?: (targetPath: string, options: { recursive: true; force: true }) => void
  queryRows?: (databasePath: string, hostKeys: string[]) => ChromeCookieDatabaseRow[]
  readFile?: (targetPath: string) => string
  runCommand?: (command: string, args: string[]) => string
}

type ChromeCookieCryptoCache = {
  macKey?: Buffer
  linuxV11Key?: Buffer | null
  windowsKey?: Buffer
}

const CHROMIUM_EPOCH_MICROSECONDS = 11644473600000000n
const POSIX_IV = Buffer.from(" ".repeat(16), "utf8")
const POSIX_SALT = "saltysalt"
const MAC_SAFE_STORAGE_SERVICE = "Chrome Safe Storage"
const MAC_SAFE_STORAGE_ACCOUNT = "Chrome"
const LINUX_V10_PASSWORD = "peanuts"
const WINDOWS_DPAPI_KEY_PREFIX = Buffer.from("DPAPI", "utf8")
const WINDOWS_APP_BOUND_KEY_PREFIX = Buffer.from("APPB", "utf8")

function loadDatabaseConstructor(): DatabaseConstructor {
  const sqlite = require("node:sqlite") as {
    DatabaseSync: DatabaseConstructor
  }

  return sqlite.DatabaseSync
}

function chromiumTimestampToUnixSeconds(timestamp: number | bigint): number {
  if (typeof timestamp === "bigint") {
    return Number((timestamp - CHROMIUM_EPOCH_MICROSECONDS) / 1000000n)
  }

  return Math.trunc(
    (timestamp - Number(CHROMIUM_EPOCH_MICROSECONDS)) / 1000000
  )
}

function normalizeChromeCookie(raw: ChromePuppeteerCookie): Cookie {
  const normalized = {
    name: raw.name,
    value: raw.value,
    domain: raw.domain,
    path: raw.path,
    httpOnly: raw.HttpOnly,
    secure: raw.Secure,
    sameSite: raw.sameSite,
  } as Parameters<typeof normalizeCookie>[0] & { expires?: number }

  if (raw.expires !== 0) {
    normalized.expires = chromiumTimestampToUnixSeconds(raw.expires)
  }

  return normalizeCookie(normalized)
}

export async function readChromeCookies(
  options: { url: string; profile?: string },
  getCookies: ChromeCookieReader = createChromeCookieReader()
): Promise<Cookie[]> {
  const cookies = await getCookies(options.url, "puppeteer", options.profile)
  return cookies.map(normalizeChromeCookie)
}

export function createChromeCookieReader(
  dependencies: ChromeCookieReaderDependencies = {}
): ChromeCookieReader {
  return async (url: string, format: "puppeteer", profile?: string) => {
    if (format !== "puppeteer") {
      throw new Error("cloak only supports Chrome cookie export in puppeteer format")
    }

    const parsedUrl = parseCookieUrl(url)
    const chromeUserDataDir =
      dependencies.chromeUserDataDir ?? defaultChromeUserDataDir()
    const pathExists = dependencies.pathExists ?? fs.existsSync
    const makeTempDir = dependencies.makeTempDir ?? fs.mkdtempSync
    const copyFile = dependencies.copyFile ?? fs.copyFileSync
    const removeDir = dependencies.removeDir ?? fs.rmSync
    const queryRows = dependencies.queryRows ?? queryChromeCookieRows
    const sourcePath = resolveChromeCookiesDatabasePath(
      {
        chromeUserDataDir,
        profileDirectory: profile ?? "Default",
      },
      {
        pathExists,
      }
    )

    if (!sourcePath) {
      return []
    }

    const tempRoot = makeTempDir(path.join(os.tmpdir(), "cloak-cookie-db-"))
    const stagedPath = path.join(tempRoot, path.basename(sourcePath))

    try {
      copyFile(sourcePath, stagedPath)
      copyOptionalSidecar(`${sourcePath}-wal`, `${stagedPath}-wal`, pathExists, copyFile)
      copyOptionalSidecar(`${sourcePath}-shm`, `${stagedPath}-shm`, pathExists, copyFile)

      const rows = queryRows(stagedPath, candidateChromeCookieHosts(parsedUrl.hostname))
      const cryptoCache: ChromeCookieCryptoCache = {}
      const cookies: ChromePuppeteerCookie[] = []

      for (const row of rows) {
        if (!chromeCookieMatchesUrl(row, parsedUrl)) {
          continue
        }

        cookies.push(
          rowToPuppeteerCookie(row, {
            ...dependencies,
            chromeUserDataDir,
          }, cryptoCache)
        )
      }

      return cookies
    } finally {
      removeDir(tempRoot, { recursive: true, force: true })
    }
  }
}

export function candidateChromeCookieHosts(hostname: string): string[] {
  const normalizedHost = hostname.trim().toLowerCase().replace(/\.$/, "")

  if (!normalizedHost) {
    return []
  }

  const labels = normalizedHost.split(".")
  const hosts = new Set<string>()

  for (let index = 0; index < labels.length; index += 1) {
    const candidate = labels.slice(index).join(".")
    hosts.add(candidate)
    hosts.add(`.${candidate}`)
  }

  return [...hosts]
}

export function chromeCookieMatchesUrl(
  row: Pick<ChromeCookieDatabaseRow, "host_key" | "path" | "is_secure">,
  url: URL
): boolean {
  if (toBoolean(row.is_secure) && url.protocol !== "https:") {
    return false
  }

  if (!hostMatchesCookieDomain(url.hostname, row.host_key)) {
    return false
  }

  return pathMatchesCookiePath(url.pathname || "/", row.path || "/")
}

function parseCookieUrl(url: string): URL {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error(
      "Could not parse URI, format should be http://www.example.com/path/"
    )
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(
      "Could not parse URI, format should be http://www.example.com/path/"
    )
  }

  return parsedUrl
}

function rowToPuppeteerCookie(
  row: ChromeCookieDatabaseRow,
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): ChromePuppeteerCookie {
  const resolvedValue = resolveChromeCookieValue(row, dependencies, cryptoCache)
  const cookie: ChromePuppeteerCookie = {
    name: row.name,
    value: resolvedValue,
    domain: row.host_key,
    path: row.path,
    expires: typeof row.expires_utc === "bigint"
      ? Number(row.expires_utc)
      : row.expires_utc,
  }

  if (toBoolean(row.is_secure)) {
    cookie.Secure = true
  }

  if (toBoolean(row.is_httponly)) {
    cookie.HttpOnly = true
  }

  const sameSite = databaseSameSiteToChromeSameSite(row.samesite)
  if (sameSite) {
    cookie.sameSite = sameSite
  }

  return cookie
}

function resolveChromeCookieValue(
  row: ChromeCookieDatabaseRow,
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): string {
  const encryptedValue = toBuffer(row.encrypted_value)

  if (encryptedValue.length === 0) {
    return row.value
  }

  const decrypted = decryptChromeCookieValue(
    encryptedValue,
    row.host_key,
    dependencies,
    cryptoCache
  )

  return stripEncryptedCookieDomainHash(decrypted, row.host_key).toString("utf8")
}

function decryptChromeCookieValue(
  encryptedValue: Buffer,
  hostKey: string,
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): Buffer {
  const platform = dependencies.platform ?? process.platform

  if (platform === "darwin") {
    return decryptPosixCookieValue(
      encryptedValue,
      getMacEncryptionKey(dependencies, cryptoCache)
    )
  }

  if (platform === "linux") {
    return decryptLinuxCookieValue(encryptedValue, dependencies, cryptoCache)
  }

  if (platform === "win32") {
    return decryptWindowsCookieValue(
      encryptedValue,
      hostKey,
      dependencies,
      cryptoCache
    )
  }

  throw new Error(CHROME_COOKIE_SUPPORT_MISSING_ERROR)
}

function decryptPosixCookieValue(encryptedValue: Buffer, key: Buffer): Buffer {
  const version = encryptedValue.subarray(0, 3).toString("utf8")

  if (version !== "v10" && version !== "v11") {
    throw new Error(CHROME_COOKIE_SUPPORT_MISSING_ERROR)
  }

  const decipher = createDecipheriv("aes-128-cbc", key, POSIX_IV)

  return Buffer.concat([
    decipher.update(encryptedValue.subarray(3)),
    decipher.final(),
  ])
}

function decryptLinuxCookieValue(
  encryptedValue: Buffer,
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): Buffer {
  const version = encryptedValue.subarray(0, 3).toString("utf8")

  if (version === "v10") {
    return decryptPosixCookieValue(encryptedValue, derivePosixKey(LINUX_V10_PASSWORD, 1))
  }

  if (version === "v11") {
    const key = getLinuxV11EncryptionKey(dependencies, cryptoCache)

    if (key) {
      return decryptPosixCookieValue(encryptedValue, key)
    }

    return decryptPosixCookieValue(encryptedValue, derivePosixKey("", 1))
  }

  throw new Error(CHROME_COOKIE_SUPPORT_MISSING_ERROR)
}

function decryptWindowsCookieValue(
  encryptedValue: Buffer,
  _hostKey: string,
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): Buffer {
  const version = encryptedValue.subarray(0, 3).toString("utf8")

  if (version === "v20") {
    throw new Error(CHROME_COOKIE_APP_BOUND_UNSUPPORTED_ERROR)
  }

  if (version !== "v10") {
    return decryptWindowsDpapi(encryptedValue, dependencies)
  }

  const key = getWindowsEncryptionKey(dependencies, cryptoCache)
  const nonce = encryptedValue.subarray(3, 15)
  const ciphertext = encryptedValue.subarray(15, encryptedValue.length - 16)
  const authTag = encryptedValue.subarray(encryptedValue.length - 16)
  const decipher = createDecipheriv("aes-256-gcm", key, nonce)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

function getMacEncryptionKey(
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): Buffer {
  if (cryptoCache.macKey) {
    return cryptoCache.macKey
  }

  const password = runCommand(dependencies, "security", [
    "find-generic-password",
    "-w",
    "-s",
    MAC_SAFE_STORAGE_SERVICE,
    "-a",
    MAC_SAFE_STORAGE_ACCOUNT,
  ]).trimEnd()

  if (!password) {
    throw new Error(CHROME_COOKIE_SUPPORT_MISSING_ERROR)
  }

  cryptoCache.macKey = derivePosixKey(password, 1003)
  return cryptoCache.macKey
}

function getLinuxV11EncryptionKey(
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): Buffer | null {
  if (cryptoCache.linuxV11Key !== undefined) {
    return cryptoCache.linuxV11Key
  }

  try {
    const password = runCommand(dependencies, "secret-tool", [
      "lookup",
      "xdg:schema",
      "chrome_libsecret_os_crypt_password",
    ]).trimEnd()

    cryptoCache.linuxV11Key =
      password.length > 0 ? derivePosixKey(password, 1) : null
  } catch {
    cryptoCache.linuxV11Key = null
  }

  return cryptoCache.linuxV11Key
}

function getWindowsEncryptionKey(
  dependencies: ChromeCookieReaderDependencies,
  cryptoCache: ChromeCookieCryptoCache
): Buffer {
  if (cryptoCache.windowsKey) {
    return cryptoCache.windowsKey
  }

  const chromeUserDataDir =
    dependencies.chromeUserDataDir ?? defaultChromeUserDataDir()
  const readFile = dependencies.readFile ?? ((targetPath: string) => fs.readFileSync(targetPath, "utf8"))
  const localStatePath = path.join(chromeUserDataDir, "Local State")
  const localState = JSON.parse(readFile(localStatePath)) as {
    os_crypt?: {
      encrypted_key?: string
    }
  }
  const encodedKey = localState.os_crypt?.encrypted_key

  if (!encodedKey) {
    throw new Error(CHROME_COOKIE_SUPPORT_MISSING_ERROR)
  }

  const encryptedKey = Buffer.from(encodedKey, "base64")

  if (encryptedKey.subarray(0, WINDOWS_APP_BOUND_KEY_PREFIX.length).equals(WINDOWS_APP_BOUND_KEY_PREFIX)) {
    throw new Error(CHROME_COOKIE_APP_BOUND_UNSUPPORTED_ERROR)
  }

  if (!encryptedKey.subarray(0, WINDOWS_DPAPI_KEY_PREFIX.length).equals(WINDOWS_DPAPI_KEY_PREFIX)) {
    throw new Error(CHROME_COOKIE_SUPPORT_MISSING_ERROR)
  }

  cryptoCache.windowsKey = decryptWindowsDpapi(
    encryptedKey.subarray(WINDOWS_DPAPI_KEY_PREFIX.length),
    dependencies
  )

  return cryptoCache.windowsKey
}

function decryptWindowsDpapi(
  encryptedValue: Buffer,
  dependencies: ChromeCookieReaderDependencies
): Buffer {
  const script = [
    "$inputBase64 = $args[0]",
    "$bytes = [Convert]::FromBase64String($inputBase64)",
    "$plain = [System.Security.Cryptography.ProtectedData]::Unprotect(",
    "  $bytes,",
    "  $null,",
    "  [System.Security.Cryptography.DataProtectionScope]::CurrentUser",
    ")",
    "[Console]::Out.Write([Convert]::ToBase64String($plain))",
  ].join("; ")
  const base64Value = encryptedValue.toString("base64")
  const binaries = ["powershell.exe", "powershell", "pwsh"]

  for (const binary of binaries) {
    try {
      const output = runCommand(dependencies, binary, [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        script,
        base64Value,
      ]).trim()

      return Buffer.from(output, "base64")
    } catch {
      continue
    }
  }

  throw new Error(CHROME_COOKIE_SUPPORT_MISSING_ERROR)
}

function derivePosixKey(password: string, iterations: number): Buffer {
  return pbkdf2Sync(password, POSIX_SALT, iterations, 16, "sha1")
}

function stripEncryptedCookieDomainHash(
  decryptedValue: Buffer,
  hostKey: string
): Buffer {
  const domainHash = createHash("sha256").update(hostKey).digest()

  if (decryptedValue.length < domainHash.length) {
    return decryptedValue
  }

  if (decryptedValue.subarray(0, domainHash.length).equals(domainHash)) {
    return decryptedValue.subarray(domainHash.length)
  }

  return decryptedValue
}

function hostMatchesCookieDomain(hostname: string, cookieDomain: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, "")
  const normalizedDomain = cookieDomain.toLowerCase().replace(/^\./, "").replace(/\.$/, "")
  const isDomainCookie = cookieDomain.startsWith(".")

  if (!isDomainCookie) {
    return normalizedHost === normalizedDomain
  }

  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  )
}

function pathMatchesCookiePath(requestPath: string, cookiePath: string): boolean {
  const normalizedRequestPath = requestPath || "/"
  const normalizedCookiePath = cookiePath || "/"

  if (normalizedRequestPath === normalizedCookiePath) {
    return true
  }

  if (!normalizedRequestPath.startsWith(normalizedCookiePath)) {
    return false
  }

  if (normalizedCookiePath.endsWith("/")) {
    return true
  }

  return normalizedRequestPath.charAt(normalizedCookiePath.length) === "/"
}

function databaseSameSiteToChromeSameSite(
  sameSite: number | bigint | null
): string | undefined {
  const normalizedSameSite =
    typeof sameSite === "bigint" ? Number(sameSite) : sameSite

  switch (normalizedSameSite) {
    case 0:
      return "no_restriction"
    case 1:
      return "lax"
    case 2:
      return "strict"
    default:
      return undefined
  }
}

function queryChromeCookieRows(
  databasePath: string,
  hostKeys: string[]
): ChromeCookieDatabaseRow[] {
  if (hostKeys.length === 0) {
    return []
  }

  const DatabaseSync = loadDatabaseConstructor()
  const database = new DatabaseSync(databasePath, {
    readOnly: true,
  })

  try {
    const placeholders = hostKeys.map(() => "?").join(", ")
    const statement = database.prepare(
      [
        "SELECT",
        "host_key,",
        "path,",
        "is_secure,",
        "expires_utc,",
        "name,",
        "value,",
        "encrypted_value,",
        "creation_utc,",
        "is_httponly,",
        "samesite",
        "FROM cookies",
        `WHERE host_key IN (${placeholders})`,
        "ORDER BY LENGTH(path) DESC, creation_utc ASC",
      ].join(" ")
    )

    return statement.all(...hostKeys) as ChromeCookieDatabaseRow[]
  } finally {
    database.close()
  }
}

function copyOptionalSidecar(
  sourcePath: string,
  targetPath: string,
  pathExists: (targetPath: string) => boolean,
  copyFile: (sourcePath: string, targetPath: string) => void
) {
  if (!pathExists(sourcePath)) {
    return
  }

  copyFile(sourcePath, targetPath)
}

function runCommand(
  dependencies: ChromeCookieReaderDependencies,
  command: string,
  args: string[]
): string {
  const invoke =
    dependencies.runCommand ??
    ((binary: string, binaryArgs: string[]) =>
      execFileSync(binary, binaryArgs, {
        encoding: "utf8",
        windowsHide: true,
      }))

  return invoke(command, args)
}

function toBoolean(value: number | bigint): boolean {
  if (typeof value === "bigint") {
    return value !== 0n
  }

  return value !== 0
}

function toBuffer(value: Uint8Array | null): Buffer {
  return value ? Buffer.from(value) : Buffer.alloc(0)
}
