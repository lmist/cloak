"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const chrome_profiles_js_1 = require("./chrome-profiles.js");
(0, node_test_1.default)("listChromeProfiles returns profiles with valid Preferences files", () => {
    const files = {
        "/chrome/Default/Preferences": JSON.stringify({ profile: { name: "Person 1" } }),
        "/chrome/Profile 1/Preferences": JSON.stringify({
            profile: { name: "Work" },
            account_info: [{ full_name: "Alice Smith" }],
        }),
    };
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/chrome",
        readdir: () => ["Default", "Profile 1", "CrashpadMetrics", "Local State"],
        readFile: (p) => {
            if (files[p] !== undefined)
                return files[p];
            throw new Error(`ENOENT: ${p}`);
        },
    });
    strict_1.default.deepEqual(result, [
        { directory: "Default", name: "Person 1" },
        { directory: "Profile 1", name: "Work", accountName: "Alice Smith" },
    ]);
});
(0, node_test_1.default)("listChromeProfiles skips directories without Preferences", () => {
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/chrome",
        readdir: () => ["Default", "Profile 1"],
        readFile: () => {
            throw new Error("ENOENT");
        },
    });
    strict_1.default.deepEqual(result, []);
});
(0, node_test_1.default)("listChromeProfiles returns empty when Chrome data dir does not exist", () => {
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/nonexistent",
        readdir: () => {
            throw new Error("ENOENT");
        },
        readFile: () => {
            throw new Error("ENOENT");
        },
    });
    strict_1.default.deepEqual(result, []);
});
(0, node_test_1.default)("listChromeProfiles ignores non-profile directories", () => {
    const files = {
        "/chrome/Default/Preferences": JSON.stringify({ profile: { name: "Main" } }),
    };
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/chrome",
        readdir: () => ["Default", "GrShaderCache", "ShaderCache", "extensions_crx_cache"],
        readFile: (p) => {
            if (files[p] !== undefined)
                return files[p];
            throw new Error(`ENOENT: ${p}`);
        },
    });
    strict_1.default.deepEqual(result, [
        { directory: "Default", name: "Main" },
    ]);
});
(0, node_test_1.default)("listChromeProfiles sorts profiles by directory name", () => {
    const files = {
        "/chrome/Profile 2/Preferences": JSON.stringify({ profile: { name: "Gaming" } }),
        "/chrome/Default/Preferences": JSON.stringify({ profile: { name: "Main" } }),
        "/chrome/Profile 1/Preferences": JSON.stringify({ profile: { name: "Work" } }),
    };
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/chrome",
        readdir: () => ["Profile 2", "Default", "Profile 1"],
        readFile: (p) => {
            if (files[p] !== undefined)
                return files[p];
            throw new Error(`ENOENT: ${p}`);
        },
    });
    strict_1.default.deepEqual(result, [
        { directory: "Default", name: "Main" },
        { directory: "Profile 1", name: "Work" },
        { directory: "Profile 2", name: "Gaming" },
    ]);
});
(0, node_test_1.default)("listChromeProfiles handles malformed Preferences JSON gracefully", () => {
    const files = {
        "/chrome/Default/Preferences": "not json",
        "/chrome/Profile 1/Preferences": JSON.stringify({ profile: { name: "Work" } }),
    };
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/chrome",
        readdir: () => ["Default", "Profile 1"],
        readFile: (p) => {
            if (files[p] !== undefined)
                return files[p];
            throw new Error(`ENOENT: ${p}`);
        },
    });
    strict_1.default.deepEqual(result, [
        { directory: "Profile 1", name: "Work" },
    ]);
});
(0, node_test_1.default)("listChromeProfiles includes accountName from account_info when present", () => {
    const files = {
        "/chrome/Default/Preferences": JSON.stringify({
            profile: { name: "Person 1" },
            account_info: [{ full_name: "Louai Misto" }],
        }),
        "/chrome/Profile 1/Preferences": JSON.stringify({
            profile: { name: "Your Chrome" },
            account_info: [{}],
        }),
        "/chrome/Profile 2/Preferences": JSON.stringify({
            profile: { name: "Guest" },
        }),
    };
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/chrome",
        readdir: () => ["Default", "Profile 1", "Profile 2"],
        readFile: (p) => {
            if (files[p] !== undefined)
                return files[p];
            throw new Error(`ENOENT: ${p}`);
        },
    });
    strict_1.default.deepEqual(result, [
        { directory: "Default", name: "Person 1", accountName: "Louai Misto" },
        { directory: "Profile 1", name: "Your Chrome" },
        { directory: "Profile 2", name: "Guest" },
    ]);
});
(0, node_test_1.default)("listChromeProfiles handles Preferences missing profile.name", () => {
    const files = {
        "/chrome/Default/Preferences": JSON.stringify({ extensions: {} }),
        "/chrome/Profile 1/Preferences": JSON.stringify({ profile: { name: "Work" } }),
    };
    const result = (0, chrome_profiles_js_1.listChromeProfiles)({
        chromeUserDataDir: "/chrome",
        readdir: () => ["Default", "Profile 1"],
        readFile: (p) => {
            if (files[p] !== undefined)
                return files[p];
            throw new Error(`ENOENT: ${p}`);
        },
    });
    strict_1.default.deepEqual(result, [
        { directory: "Profile 1", name: "Work" },
    ]);
});
