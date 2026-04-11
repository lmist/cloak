import fs from "node:fs";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

interface BrowserExportCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  session?: boolean;
  sameSite?: string;
  storeId?: string;
}

type CookieFileEntry = Cookie | BrowserExportCookie;

function normalizeSameSite(
  sameSite: string | undefined
): Cookie["sameSite"] | undefined {
  if (!sameSite) return undefined;

  switch (sameSite.toLowerCase()) {
    case "strict":
      return "Strict";
    case "lax":
      return "Lax";
    case "none":
    case "no_restriction":
      return "None";
    case "unspecified":
      return undefined;
    default:
      return undefined;
  }
}

export function normalizeCookie(raw: Cookie | BrowserExportCookie): Cookie {
  const cookie: Cookie = {
    name: raw.name,
    value: raw.value,
    domain: raw.domain,
    path: raw.path,
  };

  if (typeof raw.httpOnly === "boolean") {
    cookie.httpOnly = raw.httpOnly;
  }

  if (typeof raw.secure === "boolean") {
    cookie.secure = raw.secure;
  }

  if ("expires" in raw && typeof raw.expires === "number") {
    cookie.expires = Math.trunc(raw.expires);
  } else if (
    "expirationDate" in raw &&
    typeof raw.expirationDate === "number"
  ) {
    cookie.expires = Math.trunc(raw.expirationDate);
  }

  const sameSite = normalizeSameSite(raw.sameSite);
  if (sameSite) {
    cookie.sameSite = sameSite;
  }

  return cookie;
}

function isCookieEntry(value: unknown): value is CookieFileEntry {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as CookieFileEntry).name === "string" &&
    typeof (value as CookieFileEntry).value === "string" &&
    typeof (value as CookieFileEntry).domain === "string" &&
    typeof (value as CookieFileEntry).path === "string"
  );
}

function parseCookieFileContents(
  value: unknown,
  sourceLabel: string
): CookieFileEntry[] {
  let entries: unknown[] | undefined;

  if (Array.isArray(value)) {
    entries = value;
  } else if (
    value &&
    typeof value === "object" &&
    "cookies" in value &&
    Array.isArray(value.cookies)
  ) {
    entries = value.cookies;
  }

  if (!entries) {
    throw new Error(
      `${sourceLabel} must contain a JSON array of cookies or a JSON object with a cookies array`
    );
  }

  return entries.map((entry: unknown, index: number) => {
    if (!isCookieEntry(entry)) {
      throw new Error(
        `${sourceLabel} contains an invalid cookie at index ${index}`
      );
    }

    return entry;
  });
}

export function parseCookieFile(
  contents: string,
  sourceLabel = "cookie file"
): Cookie[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error(`${sourceLabel} must contain valid JSON`);
  }

  return parseCookieFileContents(parsed, sourceLabel).map(normalizeCookie);
}

export function readCookiesFromFile(
  filePath: string,
  readFile: (path: string, encoding: "utf8") => string = fs.readFileSync
): Cookie[] {
  const contents = readFile(filePath, "utf8");
  return parseCookieFile(contents, filePath);
}
