import path from "node:path";
import chrome from "chrome-cookies-secure";
import { normalizeCookie, type Cookie } from "./cookies.js";

type ChromePuppeteerCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  HttpOnly?: boolean;
  Secure?: boolean;
  sameSite?: string;
};

type ChromeCookieReader = (
  url: string,
  format: "puppeteer",
  profile?: string
) => Promise<ChromePuppeteerCookie[]>;

const CHROMIUM_EPOCH_MICROSECONDS = 11644473600000000;

function chromiumTimestampToUnixSeconds(timestamp: number): number {
  return Math.trunc((timestamp - CHROMIUM_EPOCH_MICROSECONDS) / 1000000);
}

export function defaultCookieOutputPath(
  url: string,
  cookiesDir: string
): string {
  return path.join(cookiesDir, `${new URL(url).hostname.toLowerCase()}.json`);
}

function normalizeChromeCookie(raw: ChromePuppeteerCookie): Cookie {
  return normalizeCookie({
    name: raw.name,
    value: raw.value,
    domain: raw.domain,
    path: raw.path,
    expires: chromiumTimestampToUnixSeconds(raw.expires),
    httpOnly: raw.HttpOnly,
    secure: raw.Secure,
    sameSite: raw.sameSite,
  });
}

export async function readChromeCookies(
  options: { url: string; profile?: string },
  getCookies: ChromeCookieReader = chrome.getCookiesPromised
): Promise<Cookie[]> {
  const cookies = await getCookies(options.url, "puppeteer", options.profile);
  return cookies.map(normalizeChromeCookie);
}
