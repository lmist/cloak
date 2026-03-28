"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCookie = normalizeCookie;
exports.mergeCookies = mergeCookies;
exports.loadCookies = loadCookies;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function normalizeSameSite(sameSite) {
    if (!sameSite)
        return undefined;
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
function normalizeCookie(raw) {
    const cookie = {
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
    }
    else if ("expirationDate" in raw &&
        typeof raw.expirationDate === "number") {
        cookie.expires = Math.trunc(raw.expirationDate);
    }
    const sameSite = normalizeSameSite(raw.sameSite);
    if (sameSite) {
        cookie.sameSite = sameSite;
    }
    return cookie;
}
function cookieIdentity(cookie) {
    return `${cookie.name}\u0000${cookie.domain}\u0000${cookie.path}`;
}
function mergeCookies(diskCookies, browserCookies) {
    const merged = new Map();
    for (const cookie of diskCookies) {
        merged.set(cookieIdentity(cookie), cookie);
    }
    for (const cookie of browserCookies) {
        merged.set(cookieIdentity(cookie), cookie);
    }
    return [...merged.values()];
}
async function loadCookies(cookiesDir) {
    if (!node_fs_1.default.existsSync(cookiesDir)) {
        console.log("No cookies/ directory found");
        return [];
    }
    const files = node_fs_1.default
        .readdirSync(cookiesDir)
        .filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
        console.log("No .json files in cookies/");
        return [];
    }
    const all = [];
    for (const file of files) {
        const filePath = node_path_1.default.join(cookiesDir, file);
        const raw = node_fs_1.default.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const cookies = parsed.map(normalizeCookie);
        all.push(...cookies);
        console.log(`Loaded ${cookies.length} cookies from ${file}`);
    }
    return all;
}
