"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listChromeProfiles = listChromeProfiles;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
function defaultChromeUserDataDir() {
    const platform = node_os_1.default.platform();
    const home = node_os_1.default.homedir();
    if (platform === "darwin") {
        return node_path_1.default.join(home, "Library", "Application Support", "Google", "Chrome");
    }
    if (platform === "win32") {
        return node_path_1.default.join(home, "AppData", "Local", "Google", "Chrome", "User Data");
    }
    // Linux
    return node_path_1.default.join(home, ".config", "google-chrome");
}
function readProfileInfo(prefsPath, readFile) {
    try {
        const raw = readFile(prefsPath);
        const prefs = JSON.parse(raw);
        const name = prefs?.profile?.name;
        if (name === undefined)
            return undefined;
        const accountName = prefs?.account_info?.[0]?.full_name || undefined;
        return { name, accountName };
    }
    catch {
        return undefined;
    }
}
function listChromeProfiles(dependencies = {}) {
    const userDataDir = dependencies.chromeUserDataDir ?? defaultChromeUserDataDir();
    const readdir = dependencies.readdir ?? ((dir) => node_fs_1.default.readdirSync(dir));
    const readFile = dependencies.readFile ?? ((p) => node_fs_1.default.readFileSync(p, "utf8"));
    let entries;
    try {
        entries = readdir(userDataDir);
    }
    catch {
        return [];
    }
    const profiles = [];
    for (const entry of entries) {
        if (entry !== "Default" && !entry.startsWith("Profile ")) {
            continue;
        }
        const prefsPath = node_path_1.default.join(userDataDir, entry, "Preferences");
        const info = readProfileInfo(prefsPath, readFile);
        if (info !== undefined) {
            profiles.push({
                directory: entry,
                name: info.name,
                ...(info.accountName ? { accountName: info.accountName } : {}),
            });
        }
    }
    profiles.sort((a, b) => a.directory.localeCompare(b.directory));
    return profiles;
}
