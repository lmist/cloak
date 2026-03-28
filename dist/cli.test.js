"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_child_process_1 = require("node:child_process");
const cli_js_1 = require("./cli.js");
function runNodeScript(script) {
    return (0, node_child_process_1.spawnSync)(process.execPath, ["-e", script], {
        cwd: process.cwd(),
        encoding: "utf8",
    });
}
(0, node_test_1.default)("parseCli defaults to run mode with headless false", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)(["node", "dist/main.js"]), {
        mode: "run",
        headless: false,
    });
});
(0, node_test_1.default)("parseCli enables headless mode with --headless", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)(["node", "dist/main.js", "--headless"]), {
        mode: "run",
        headless: true,
    });
});
(0, node_test_1.default)("parseCli parses runtime browser-cookie config", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--engine",
        "patchright",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
        "--chrome-profile",
        "Profile 2",
    ]), {
        mode: "run",
        headless: false,
        engine: "patchright",
        browserCookies: {
            browser: "chrome",
            url: "https://x.com",
            profile: "Profile 2",
        },
    });
});
(0, node_test_1.default)("parseCli rejects --cookie-url without --cookies-from-browser", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--cookie-url",
        "https://x.com",
    ]), /cookies-from-browser/i);
});
(0, node_test_1.default)("parseCli rejects --cookie-url with a help token as its value", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--cookie-url",
        "--help",
    ]), /invalid url|invalid/i);
});
(0, node_test_1.default)("parseCli rejects non-http browser-cookie URLs", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "file:///tmp/cookies.txt",
    ]), /invalid url/i);
});
(0, node_test_1.default)("parseCli rejects --chrome-profile without --cookies-from-browser", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--chrome-profile",
        "Profile 2",
    ]), /cookies-from-browser/i);
});
(0, node_test_1.default)("parseCli accepts an explicit playwright engine selection", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)(["node", "dist/main.js", "--engine", "playwright"]), {
        mode: "run",
        headless: false,
        engine: "playwright",
    });
});
(0, node_test_1.default)("parseCli rejects unsupported engine values", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)(["node", "dist/main.js", "--engine", "selenium"]), /unsupported engine/i);
});
(0, node_test_1.default)("parseCli parses import-cookies mode", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "import-cookies",
        "--browser",
        "chrome",
        "--url",
        "https://x.com",
    ]), {
        mode: "import-cookies",
        browser: "chrome",
        url: "https://x.com",
    });
});
(0, node_test_1.default)("parseCli parses config get engine mode", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)(["node", "dist/main.js", "config", "get", "engine"]), {
        mode: "config-get",
        key: "engine",
    });
});
(0, node_test_1.default)("parseCli parses config set engine mode", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)(["node", "dist/main.js", "config", "set", "engine", "patchright"]), {
        mode: "config-set",
        key: "engine",
        value: "patchright",
    });
});
(0, node_test_1.default)("parseCli parses config path mode", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)(["node", "dist/main.js", "config", "path"]), {
        mode: "config-path",
    });
});
(0, node_test_1.default)("parseCli rejects unsupported browser values for import-cookies", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "import-cookies",
        "--browser",
        "firefox",
        "--url",
        "https://x.com",
    ]), /unsupported browser/i);
});
(0, node_test_1.default)("parseCli rejects unsupported engine values for config set", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "config",
        "set",
        "engine",
        "selenium",
    ]), /unsupported engine/i);
});
(0, node_test_1.default)("parseCli does not write Commander errors to stderr for run mode", () => {
    const result = runNodeScript(`
    const { parseCli } = require("./dist/cli.js");
    try {
      parseCli(["node", "dist/main.js", "--cookie-url", "https://x.com"]);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  `);
    strict_1.default.equal(result.status, 1);
    strict_1.default.equal(result.stderr, "");
});
(0, node_test_1.default)("parseCli does not write Commander errors to stderr for import-cookies mode", () => {
    const result = runNodeScript(`
    const { parseCli } = require("./dist/cli.js");
    try {
      parseCli(["node", "dist/main.js", "import-cookies", "--browser", "chrome"]);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  `);
    strict_1.default.equal(result.status, 1);
    strict_1.default.equal(result.stderr, "");
});
(0, node_test_1.default)("parseCli rejects unsupported browser values for runtime browser cookies", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "firefox",
        "--cookie-url",
        "https://x.com",
    ]), /unsupported browser/i);
});
(0, node_test_1.default)("parseCli requires --cookie-url when --cookies-from-browser is used", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
    ]), /cookie-url/i);
});
(0, node_test_1.default)("parseCli requires --browser for import-cookies", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "import-cookies",
        "--url",
        "https://x.com",
    ]), /browser/i);
});
(0, node_test_1.default)("parseCli requires --url for import-cookies", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "import-cookies",
        "--browser",
        "chrome",
    ]), /url/i);
});
(0, node_test_1.default)("parseCli rejects --url with a help token as its value", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "import-cookies",
        "--browser",
        "chrome",
        "--url",
        "--help",
    ]), /invalid url|invalid/i);
});
(0, node_test_1.default)("parseCli rejects non-http import URLs", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "import-cookies",
        "--browser",
        "chrome",
        "--url",
        "chrome://settings",
    ]), /invalid url/i);
});
(0, node_test_1.default)("isHeadlessEnabled returns false for valid import-cookies invocations", () => {
    strict_1.default.equal((0, cli_js_1.isHeadlessEnabled)([
        "node",
        "dist/main.js",
        "import-cookies",
        "--browser",
        "chrome",
        "--url",
        "https://x.com",
    ]), false);
});
(0, node_test_1.default)("isHeadlessEnabled validates import-cookies invocations through parseCli", () => {
    strict_1.default.throws(() => (0, cli_js_1.isHeadlessEnabled)(["node", "dist/main.js", "import-cookies"]), /required option/i);
});
(0, node_test_1.default)("parseCli rejects import-cookies as a chrome profile value without browser cookies", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "--chrome-profile",
        "import-cookies",
    ]), /cookies-from-browser/i);
});
(0, node_test_1.default)("parseCli parses list-profiles mode", () => {
    strict_1.default.deepEqual((0, cli_js_1.parseCli)(["node", "dist/main.js", "list-profiles"]), {
        mode: "list-profiles",
    });
});
(0, node_test_1.default)("parseCli rejects stray positional operands in run mode", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)(["node", "dist/main.js", "foo"]), /too many arguments/i);
});
(0, node_test_1.default)("parseCli rejects excess operands in import-cookies mode", () => {
    strict_1.default.throws(() => (0, cli_js_1.parseCli)([
        "node",
        "dist/main.js",
        "import-cookies",
        "foo",
        "--browser",
        "chrome",
        "--url",
        "https://x.com",
    ]), /too many arguments/i);
});
(0, node_test_1.default)("node dist/main.js --help exits cleanly with usage output", () => {
    const result = (0, node_child_process_1.spawnSync)(process.execPath, ["dist/main.js", "--help"], {
        cwd: process.cwd(),
        encoding: "utf8",
    });
    strict_1.default.equal(result.status, 0);
    strict_1.default.match(result.stdout, /Usage: hedlis/i);
    strict_1.default.match(result.stdout, /import-cookies/);
    strict_1.default.equal(result.stderr, "");
});
