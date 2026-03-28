"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const cli_js_1 = require("./cli.js");
const main_js_1 = require("./main.js");
const chrome_cookies_js_1 = require("./chrome-cookies.js");
(0, node_test_1.default)("startup defaults to headed mode", () => {
    strict_1.default.equal((0, cli_js_1.isHeadlessEnabled)(["node", "dist/main.js"]), false);
});
(0, node_test_1.default)("startup enables headless mode with --headless", () => {
    strict_1.default.equal((0, cli_js_1.isHeadlessEnabled)(["node", "dist/main.js", "--headless"]), true);
});
(0, node_test_1.default)("startup defaults to no browser-cookie access when no flags are present", async () => {
    const cli = parseRunCli(["node", "dist/main.js"]);
    let readChromeCookiesCalls = 0;
    const cookies = await (0, main_js_1.resolveStartupCookies)(cli, {
        cookiesDir: "/tmp/cookies",
        loadCookies: async () => [],
        readChromeCookies: async () => {
            readChromeCookiesCalls += 1;
            return [];
        },
    });
    strict_1.default.deepEqual(cookies, []);
    strict_1.default.equal(readChromeCookiesCalls, 0);
});
(0, node_test_1.default)("runtime browser-cookie flags are parsed and threaded into startup", async () => {
    const cli = parseRunCli([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
        "--chrome-profile",
        "Profile 2",
    ]);
    const calls = [];
    await (0, main_js_1.resolveStartupCookies)(cli, {
        cookiesDir: "/tmp/cookies",
        loadCookies: async () => [],
        readChromeCookies: async (options) => {
            calls.push(options);
            return [cookie({ name: "auth", value: "runtime" })];
        },
    });
    strict_1.default.deepEqual(calls, [{ url: "https://x.com", profile: "Profile 2" }]);
});
(0, node_test_1.default)("runtime browser cookies merge with loadCookies results", async () => {
    const cli = parseRunCli([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
    ]);
    const cookies = await (0, main_js_1.resolveStartupCookies)(cli, {
        cookiesDir: "/tmp/cookies",
        loadCookies: async () => [cookie({ name: "disk", value: "1" })],
        readChromeCookies: async () => [cookie({ name: "runtime", value: "2" })],
    });
    strict_1.default.deepEqual(cookies, [
        cookie({ name: "disk", value: "1" }),
        cookie({ name: "runtime", value: "2" }),
    ]);
});
(0, node_test_1.default)("runtime browser-cookie loading warns about the Chrome duplicate-cookie limitation", async () => {
    const cli = parseRunCli([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
    ]);
    const warnings = [];
    await (0, main_js_1.resolveStartupCookies)(cli, {
        cookiesDir: "/tmp/cookies",
        loadCookies: async () => [],
        readChromeCookies: async () => [cookie({ name: "runtime", value: "2" })],
        warn: (message) => warnings.push(message),
    });
    strict_1.default.deepEqual(warnings, [chrome_cookies_js_1.CHROME_COOKIE_LIMITATION_WARNING]);
});
(0, node_test_1.default)("browser-imported cookies win exact name-domain-path collisions", async () => {
    const cli = parseRunCli([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
    ]);
    const cookies = await (0, main_js_1.resolveStartupCookies)(cli, {
        cookiesDir: "/tmp/cookies",
        loadCookies: async () => [
            cookie({ name: "auth", value: "disk", domain: ".x.com", path: "/" }),
            cookie({ name: "other", value: "keep" }),
        ],
        readChromeCookies: async () => [
            cookie({ name: "auth", value: "runtime", domain: ".x.com", path: "/" }),
        ],
    });
    strict_1.default.deepEqual(cookies, [
        cookie({ name: "auth", value: "runtime", domain: ".x.com", path: "/" }),
        cookie({ name: "other", value: "keep" }),
    ]);
});
(0, node_test_1.default)("startup fails fast when browser cookies are explicitly requested but Chrome returns none", async () => {
    const cli = parseRunCli([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
    ]);
    await strict_1.default.rejects((0, main_js_1.resolveStartupCookies)(cli, {
        cookiesDir: "/tmp/cookies",
        loadCookies: async () => [cookie({ name: "disk", value: "1" })],
        readChromeCookies: async () => [],
    }), /No cookies found for https:\/\/x\.com/);
});
(0, node_test_1.default)("main does not reach browser startup when explicit browser-cookie import returns none", async () => {
    let prepareExtensionsCalls = 0;
    let launchCalls = 0;
    await strict_1.default.rejects((0, main_js_1.main)([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
    ], {
        loadCookies: async () => [cookie({ name: "disk", value: "1" })],
        readChromeCookies: async () => [],
        prepareExtensions: async () => {
            prepareExtensionsCalls += 1;
            return [];
        },
        launchPersistentContext: async () => {
            launchCalls += 1;
            throw new Error("launch should not be called");
        },
    }), /No cookies found for https:\/\/x\.com/);
    strict_1.default.equal(prepareExtensionsCalls, 0);
    strict_1.default.equal(launchCalls, 0);
});
(0, node_test_1.default)("main honors an injected cookiesDir instead of resolving the working-directory cookies path", async () => {
    const seenCookiesDirs = [];
    await (0, main_js_1.main)(["node", "dist/main.js"], {
        cookiesDir: "/tmp/injected-cookies",
        loadCookies: async (cookiesDir) => {
            seenCookiesDirs.push(cookiesDir);
            return [];
        },
        prepareExtensions: async () => [],
        makeTempDir: () => "/tmp/vilnius-profile",
        makeDir: () => undefined,
        writeFile: () => undefined,
        launchPersistentContext: async () => fakeContext(),
    });
    strict_1.default.deepEqual(seenCookiesDirs, ["/tmp/injected-cookies"]);
});
(0, node_test_1.default)("main adds the resolved merged cookie set to the browser context on successful startup", async () => {
    const addedCookies = [];
    await (0, main_js_1.main)([
        "node",
        "dist/main.js",
        "--cookies-from-browser",
        "chrome",
        "--cookie-url",
        "https://x.com",
    ], {
        cookiesDir: "/tmp/injected-cookies",
        loadCookies: async () => [cookie({ name: "disk", value: "1" })],
        readChromeCookies: async () => [
            cookie({ name: "disk", value: "2" }),
            cookie({ name: "runtime", value: "3" }),
        ],
        prepareExtensions: async () => [],
        makeTempDir: () => "/tmp/vilnius-profile",
        makeDir: () => undefined,
        writeFile: () => undefined,
        launchPersistentContext: async () => fakeContext({ addedCookies }),
    });
    strict_1.default.deepEqual(addedCookies, [[
            cookie({ name: "disk", value: "2" }),
            cookie({ name: "runtime", value: "3" }),
        ]]);
});
(0, node_test_1.default)("main preserves the chromium launch contract for headless startup", async () => {
    const launchCalls = [];
    await (0, main_js_1.main)(["node", "dist/main.js", "--headless"], {
        cookiesDir: "/tmp/injected-cookies",
        loadCookies: async () => [],
        prepareExtensions: async () => [],
        makeTempDir: () => "/tmp/vilnius-profile",
        makeDir: () => undefined,
        writeFile: () => undefined,
        playwrightLaunchPersistentContext: async (userDataDir, options) => {
            launchCalls.push({ engine: "playwright", userDataDir, options });
            return fakeContext();
        },
        patchrightLaunchPersistentContext: async () => {
            throw new Error("patchright launch should not be used");
        },
        readConfig: () => ({}),
    });
    strict_1.default.deepEqual(launchCalls, [
        {
            engine: "playwright",
            userDataDir: "/tmp/vilnius-profile",
            options: {
                headless: true,
                channel: "chromium",
                args: [],
            },
        },
    ]);
});
(0, node_test_1.default)("main uses the configured patchright engine when no CLI engine override is present", async () => {
    const launchCalls = [];
    await (0, main_js_1.main)(["node", "dist/main.js"], {
        cookiesDir: "/tmp/injected-cookies",
        loadCookies: async () => [],
        prepareExtensions: async () => [],
        makeTempDir: () => "/tmp/vilnius-profile",
        makeDir: () => undefined,
        writeFile: () => undefined,
        readConfig: () => ({ engine: "patchright" }),
        patchrightExecutablePath: () => "/tmp/google-chrome-for-testing",
        playwrightLaunchPersistentContext: async () => {
            throw new Error("playwright launch should not be used");
        },
        patchrightLaunchPersistentContext: async (userDataDir, options) => {
            launchCalls.push({ engine: "patchright", userDataDir, options });
            return fakeContext();
        },
    });
    strict_1.default.deepEqual(launchCalls, [
        {
            engine: "patchright",
            userDataDir: "/tmp/vilnius-profile",
            options: {
                headless: false,
                executablePath: "/tmp/google-chrome-for-testing",
                args: [],
            },
        },
    ]);
});
(0, node_test_1.default)("main preserves extension loading args for the patchright engine", async () => {
    const launchCalls = [];
    await (0, main_js_1.main)(["node", "dist/main.js"], {
        cookiesDir: "/tmp/injected-cookies",
        loadCookies: async () => [],
        prepareExtensions: async () => ["/tmp/ext-a", "/tmp/ext-b"],
        makeTempDir: () => "/tmp/vilnius-profile",
        makeDir: () => undefined,
        writeFile: () => undefined,
        readConfig: () => ({ engine: "patchright" }),
        patchrightExecutablePath: () => "/tmp/google-chrome-for-testing",
        patchrightLaunchPersistentContext: async (_userDataDir, options) => {
            launchCalls.push({ options });
            return fakeContext();
        },
    });
    strict_1.default.deepEqual(launchCalls, [
        {
            options: {
                headless: false,
                executablePath: "/tmp/google-chrome-for-testing",
                args: [
                    "--disable-extensions-except=/tmp/ext-a,/tmp/ext-b",
                    "--load-extension=/tmp/ext-a,/tmp/ext-b",
                ],
            },
        },
    ]);
});
(0, node_test_1.default)("main lets the CLI engine override the configured default engine", async () => {
    const launchCalls = [];
    await (0, main_js_1.main)(["node", "dist/main.js", "--engine", "playwright"], {
        cookiesDir: "/tmp/injected-cookies",
        loadCookies: async () => [],
        prepareExtensions: async () => [],
        makeTempDir: () => "/tmp/vilnius-profile",
        makeDir: () => undefined,
        writeFile: () => undefined,
        readConfig: () => ({ engine: "patchright" }),
        playwrightLaunchPersistentContext: async () => {
            launchCalls.push("playwright");
            return fakeContext();
        },
        patchrightLaunchPersistentContext: async () => {
            throw new Error("patchright launch should not be used");
        },
    });
    strict_1.default.deepEqual(launchCalls, ["playwright"]);
});
(0, node_test_1.default)("main removes SIGINT and SIGTERM listeners before returning", async () => {
    const sigintListenersBefore = process.rawListeners("SIGINT");
    const sigtermListenersBefore = process.rawListeners("SIGTERM");
    try {
        await (0, main_js_1.main)(["node", "dist/main.js"], {
            cookiesDir: "/tmp/injected-cookies",
            loadCookies: async () => [],
            prepareExtensions: async () => [],
            makeTempDir: () => "/tmp/vilnius-profile",
            makeDir: () => undefined,
            writeFile: () => undefined,
            launchPersistentContext: async () => fakeContext(),
        });
        strict_1.default.equal(process.listenerCount("SIGINT"), sigintListenersBefore.length);
        strict_1.default.equal(process.listenerCount("SIGTERM"), sigtermListenersBefore.length);
    }
    finally {
        removeAdditionalListeners("SIGINT", sigintListenersBefore);
        removeAdditionalListeners("SIGTERM", sigtermListenersBefore);
    }
});
function cookie(overrides) {
    return {
        name: overrides.name ?? "session",
        value: overrides.value ?? "value",
        domain: overrides.domain ?? ".example.com",
        path: overrides.path ?? "/",
    };
}
function parseRunCli(argv) {
    const cli = (0, cli_js_1.parseCli)(argv);
    strict_1.default.equal(cli.mode, "run");
    return cli;
}
function fakeContext({ addedCookies, } = {}) {
    return {
        addCookies: async (cookies) => {
            addedCookies?.push(cookies);
        },
        browser: () => null,
        on: (event, callback) => {
            if (event === "close") {
                callback();
            }
        },
        close: async () => undefined,
    };
}
function removeAdditionalListeners(signal, initialListeners) {
    for (const listener of process.rawListeners(signal)) {
        if (!initialListeners.includes(listener)) {
            process.removeListener(signal, listener);
        }
    }
}
