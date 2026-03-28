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
const import_cookies_js_1 = require("./import-cookies.js");
const chrome_cookies_js_1 = require("./chrome-cookies.js");
function createTempOutputRoot() {
    const outputRoot = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "vilnius-import-"));
    node_fs_1.default.mkdirSync(node_path_1.default.join(outputRoot, "cookies"), { recursive: true });
    return outputRoot;
}
function sampleCookies() {
    return [
        {
            name: "sessionid",
            value: "abc123",
            domain: ".x.com",
            path: "/",
            httpOnly: true,
            secure: true,
        },
    ];
}
(0, node_test_1.default)("importCookiesCommand writes cookies/x.com.json by default", async () => {
    const outputRoot = createTempOutputRoot();
    await (0, import_cookies_js_1.importCookiesCommand)({
        url: "https://x.com",
        outputRoot,
    }, {
        readChromeCookies: async () => sampleCookies(),
    });
    const outputPath = node_path_1.default.join(outputRoot, "cookies", "x.com.json");
    strict_1.default.deepEqual(JSON.parse(node_fs_1.default.readFileSync(outputPath, "utf8")), sampleCookies());
});
(0, node_test_1.default)("importCookiesCommand honors an explicit output path", async () => {
    const outputRoot = createTempOutputRoot();
    const outputPath = node_path_1.default.join(outputRoot, "exports", "custom.json");
    await (0, import_cookies_js_1.importCookiesCommand)({
        url: "https://x.com",
        profile: "Profile 2",
        output: outputPath,
        outputRoot,
    }, {
        readChromeCookies: async ({ profile, }) => {
            strict_1.default.equal(profile, "Profile 2");
            return sampleCookies();
        },
    });
    strict_1.default.deepEqual(JSON.parse(node_fs_1.default.readFileSync(outputPath, "utf8")), sampleCookies());
});
(0, node_test_1.default)("importCookiesCommand overwrites an existing default target file", async () => {
    const outputRoot = createTempOutputRoot();
    const outputPath = node_path_1.default.join(outputRoot, "cookies", "x.com.json");
    node_fs_1.default.writeFileSync(outputPath, JSON.stringify([{ stale: true }]));
    await (0, import_cookies_js_1.importCookiesCommand)({
        url: "https://x.com",
        outputRoot,
    }, {
        readChromeCookies: async () => sampleCookies(),
    });
    strict_1.default.deepEqual(JSON.parse(node_fs_1.default.readFileSync(outputPath, "utf8")), sampleCookies());
});
(0, node_test_1.default)("importCookiesCommand warns about the Chrome duplicate-cookie limitation", async () => {
    const outputRoot = createTempOutputRoot();
    const warnings = [];
    await (0, import_cookies_js_1.importCookiesCommand)({
        url: "https://x.com",
        outputRoot,
    }, {
        readChromeCookies: async () => sampleCookies(),
        warn: (message) => warnings.push(message),
    });
    strict_1.default.deepEqual(warnings, [chrome_cookies_js_1.CHROME_COOKIE_LIMITATION_WARNING]);
});
(0, node_test_1.default)("importCookiesCommand fails fast when Chrome returns no cookies", async () => {
    const outputRoot = createTempOutputRoot();
    await strict_1.default.rejects((0, import_cookies_js_1.importCookiesCommand)({
        url: "https://x.com",
        outputRoot,
    }, {
        readChromeCookies: async () => [],
    }), /No cookies found/);
});
