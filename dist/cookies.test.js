"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const cookies_js_1 = require("./cookies.js");
(0, node_test_1.default)("loadCookies preserves Playwright-format cookies", async () => {
    const dir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "vilnius-cookies-"));
    const filePath = node_path_1.default.join(dir, "example.com.json");
    const source = [
        {
            name: "sessionid",
            value: "abc",
            domain: ".example.com",
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "None",
            expires: 1798830478,
        },
    ];
    node_fs_1.default.writeFileSync(filePath, JSON.stringify(source));
    const cookies = await (0, cookies_js_1.loadCookies)(dir);
    strict_1.default.deepEqual(cookies, source);
});
(0, node_test_1.default)("loadCookies normalizes browser-export JSON cookies", async () => {
    const dir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "vilnius-cookies-"));
    const filePath = node_path_1.default.join(dir, "instagram.json");
    node_fs_1.default.writeFileSync(filePath, JSON.stringify([
        {
            domain: ".instagram.com",
            expirationDate: 1798830478.408272,
            hostOnly: false,
            httpOnly: true,
            name: "mid",
            path: "/",
            sameSite: "no_restriction",
            secure: true,
            session: false,
            storeId: "0",
            value: "cookie-value",
        },
        {
            domain: ".instagram.com",
            httpOnly: true,
            name: "csrftoken",
            path: "/",
            sameSite: "unspecified",
            secure: true,
            session: true,
            value: "csrf-value",
        },
    ]));
    const cookies = await (0, cookies_js_1.loadCookies)(dir);
    strict_1.default.deepEqual(cookies, [
        {
            domain: ".instagram.com",
            expires: 1798830478,
            httpOnly: true,
            name: "mid",
            path: "/",
            sameSite: "None",
            secure: true,
            value: "cookie-value",
        },
        {
            domain: ".instagram.com",
            httpOnly: true,
            name: "csrftoken",
            path: "/",
            secure: true,
            value: "csrf-value",
        },
    ]);
});
