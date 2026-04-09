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
