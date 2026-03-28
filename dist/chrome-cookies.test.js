"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
const chrome_cookies_js_1 = require("./chrome-cookies.js");
(0, node_test_1.default)("readChromeCookies passes the requested URL to the injected reader", async () => {
    const calls = [];
    const getCookies = async (url, format, profile) => {
        calls.push([url, format, profile]);
        return [];
    };
    await (0, chrome_cookies_js_1.readChromeCookies)({ url: "https://x.com" }, getCookies);
    strict_1.default.deepEqual(calls, [["https://x.com", "puppeteer", undefined]]);
});
(0, node_test_1.default)("readChromeCookies passes the Chrome profile through to the injected reader", async () => {
    const calls = [];
    const getCookies = async (url, format, profile) => {
        calls.push([url, format, profile]);
        return [];
    };
    await (0, chrome_cookies_js_1.readChromeCookies)({ url: "https://x.com", profile: "Profile 2" }, getCookies);
    strict_1.default.deepEqual(calls, [["https://x.com", "puppeteer", "Profile 2"]]);
});
(0, node_test_1.default)("readChromeCookies normalizes persistent, expired, and session puppeteer cookies", async () => {
    const cookies = await (0, chrome_cookies_js_1.readChromeCookies)({ url: "https://x.com" }, async () => [
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
    ]);
    strict_1.default.deepEqual(cookies, [
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
    ]);
});
(0, node_test_1.default)("defaultCookieOutputPath strips the port and lowercases the hostname", () => {
    const outputPath = (0, chrome_cookies_js_1.defaultCookieOutputPath)("https://X.com:443/path", "/tmp/cookies");
    strict_1.default.equal(outputPath, node_path_1.default.join("/tmp/cookies", "x.com.json"));
});
