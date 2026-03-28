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
const config_js_1 = require("./config.js");
(0, node_test_1.default)("configFilePath uses XDG_CONFIG_HOME when present", () => {
    strict_1.default.equal((0, config_js_1.configFilePath)({
        env: {
            XDG_CONFIG_HOME: "/tmp/xdg-config",
        },
        homedir: "/Users/example",
    }), "/tmp/xdg-config/hedlis/config.toml");
});
(0, node_test_1.default)("configFilePath falls back to ~/.config/hedlis/config.toml", () => {
    strict_1.default.equal((0, config_js_1.configFilePath)({
        env: {},
        homedir: "/Users/example",
    }), "/Users/example/.config/hedlis/config.toml");
});
(0, node_test_1.default)("readConfig returns an empty object when the config file is absent", () => {
    const tempRoot = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "hedlis-config-"));
    strict_1.default.deepEqual((0, config_js_1.readConfig)(node_path_1.default.join(tempRoot, "config.toml")), {});
});
(0, node_test_1.default)("writeConfig persists the engine as TOML and readConfig loads it back", () => {
    const tempRoot = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "hedlis-config-"));
    const configPath = node_path_1.default.join(tempRoot, "config.toml");
    (0, config_js_1.writeConfig)(configPath, { engine: "patchright" });
    strict_1.default.equal(node_fs_1.default.readFileSync(configPath, "utf8"), 'engine = "patchright"\n');
    strict_1.default.deepEqual((0, config_js_1.readConfig)(configPath), {
        engine: "patchright",
    });
});
(0, node_test_1.default)("resolveEngine prefers the cli engine over the config engine", () => {
    strict_1.default.equal((0, config_js_1.resolveEngine)({
        cliEngine: "playwright",
        config: { engine: "patchright" },
    }), "playwright");
});
(0, node_test_1.default)("resolveEngine falls back to the configured engine and then the default", () => {
    strict_1.default.equal((0, config_js_1.resolveEngine)({
        config: { engine: "patchright" },
    }), "patchright");
    strict_1.default.equal((0, config_js_1.resolveEngine)({
        config: {},
    }), config_js_1.DEFAULT_ENGINE);
});
(0, node_test_1.default)("readConfig rejects unsupported engine values", () => {
    const tempRoot = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "hedlis-config-"));
    const configPath = node_path_1.default.join(tempRoot, "config.toml");
    node_fs_1.default.writeFileSync(configPath, 'engine = "selenium"\n');
    strict_1.default.throws(() => (0, config_js_1.readConfig)(configPath), /unsupported engine/i);
});
