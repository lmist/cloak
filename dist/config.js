"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ENGINE = void 0;
exports.parseEngine = parseEngine;
exports.configFilePath = configFilePath;
exports.readConfig = readConfig;
exports.writeConfig = writeConfig;
exports.resolveEngine = resolveEngine;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
exports.DEFAULT_ENGINE = "playwright";
function parseEngine(value) {
    if (value !== "playwright" && value !== "patchright") {
        throw new Error(`unsupported engine: ${value}`);
    }
    return value;
}
function configFilePath({ env = process.env, homedir = node_os_1.default.homedir(), } = {}) {
    const configHome = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim().length > 0
        ? env.XDG_CONFIG_HOME
        : node_path_1.default.join(homedir, ".config");
    return node_path_1.default.join(configHome, "hedlis", "config.toml");
}
function readConfig(filePath) {
    if (!node_fs_1.default.existsSync(filePath)) {
        return {};
    }
    const config = {};
    const lines = node_fs_1.default.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const match = /^engine\s*=\s*"([^"]+)"$/.exec(trimmed);
        if (match) {
            config.engine = parseEngine(match[1]);
            continue;
        }
        throw new Error(`Invalid config line in ${filePath}: ${line}`);
    }
    return config;
}
function writeConfig(filePath, config) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(filePath), { recursive: true });
    const lines = [];
    if (config.engine) {
        lines.push(`engine = "${config.engine}"`);
    }
    node_fs_1.default.writeFileSync(filePath, lines.length > 0 ? `${lines.join("\n")}\n` : "");
}
function resolveEngine({ cliEngine, config, }) {
    return cliEngine ?? config?.engine ?? exports.DEFAULT_ENGINE;
}
