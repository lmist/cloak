"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHROME_COOKIE_LIMITATION_WARNING = void 0;
exports.defaultCookieOutputPath = defaultCookieOutputPath;
exports.readChromeCookies = readChromeCookies;
const node_path_1 = __importDefault(require("node:path"));
const chrome_cookies_secure_1 = __importDefault(require("chrome-cookies-secure"));
const cookies_js_1 = require("./cookies.js");
exports.CHROME_COOKIE_LIMITATION_WARNING = "Known limitation: Chrome cookie extraction may collapse same-name cookies across different paths or subdomains before hedlis sees them. If imported/runtime cookies look incomplete or login still fails, this may be the cause.";
const CHROMIUM_EPOCH_MICROSECONDS = 11644473600000000;
function chromiumTimestampToUnixSeconds(timestamp) {
    return Math.trunc((timestamp - CHROMIUM_EPOCH_MICROSECONDS) / 1000000);
}
function defaultCookieOutputPath(url, cookiesDir) {
    return node_path_1.default.join(cookiesDir, `${new URL(url).hostname.toLowerCase()}.json`);
}
function normalizeChromeCookie(raw) {
    const normalized = {
        name: raw.name,
        value: raw.value,
        domain: raw.domain,
        path: raw.path,
        httpOnly: raw.HttpOnly,
        secure: raw.Secure,
        sameSite: raw.sameSite,
    };
    if (raw.expires !== 0) {
        normalized.expires = chromiumTimestampToUnixSeconds(raw.expires);
    }
    return (0, cookies_js_1.normalizeCookie)(normalized);
}
async function readChromeCookies(options, getCookies = chrome_cookies_secure_1.default.getCookiesPromised) {
    const cookies = await getCookies(options.url, "puppeteer", options.profile);
    return cookies.map(normalizeChromeCookie);
}
