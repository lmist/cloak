#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStartupCookies = resolveStartupCookies;
exports.main = main;
const playwright_1 = require("playwright");
const patchright_1 = require("patchright");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const node_fs_1 = __importDefault(require("node:fs"));
const extension_js_1 = require("./extension.js");
const cookies_js_1 = require("./cookies.js");
const cli_js_1 = require("./cli.js");
const import_cookies_js_1 = require("./import-cookies.js");
const chrome_cookies_js_1 = require("./chrome-cookies.js");
const config_js_1 = require("./config.js");
const chrome_profiles_js_1 = require("./chrome-profiles.js");
async function resolveStartupCookies(cli, dependencies = {}) {
    const cookiesDir = dependencies.cookiesDir ?? node_path_1.default.resolve("cookies");
    const loadCookiesFn = dependencies.loadCookies ?? cookies_js_1.loadCookies;
    const diskCookies = await loadCookiesFn(cookiesDir);
    if (!cli.browserCookies) {
        return diskCookies;
    }
    const readChromeCookiesFn = dependencies.readChromeCookies ?? chrome_cookies_js_1.readChromeCookies;
    const warn = dependencies.warn ?? console.warn;
    const browserCookies = await readChromeCookiesFn({
        url: cli.browserCookies.url,
        profile: cli.browserCookies.profile,
    });
    if (browserCookies.length === 0) {
        throw new Error(`No cookies found for ${cli.browserCookies.url}`);
    }
    warn(chrome_cookies_js_1.CHROME_COOKIE_LIMITATION_WARNING);
    return (0, cookies_js_1.mergeCookies)(diskCookies, browserCookies);
}
async function main(argv = process.argv, dependencies = {}) {
    const cli = (0, cli_js_1.parseCli)(argv);
    const resolvedConfigPath = dependencies.configPath ?? (0, config_js_1.configFilePath)();
    if (cli.mode === "config-path") {
        console.log(resolvedConfigPath);
        return;
    }
    if (cli.mode === "config-get") {
        const readConfigFn = dependencies.readConfig ?? config_js_1.readConfig;
        const config = readConfigFn(resolvedConfigPath);
        console.log((0, config_js_1.resolveEngine)({ config }));
        return;
    }
    if (cli.mode === "config-set") {
        const readConfigFn = dependencies.readConfig ?? config_js_1.readConfig;
        const writeConfigFn = dependencies.writeConfig ?? config_js_1.writeConfig;
        const config = readConfigFn(resolvedConfigPath);
        writeConfigFn(resolvedConfigPath, {
            ...config,
            engine: cli.value,
        });
        console.log(`Set engine to ${cli.value} in ${resolvedConfigPath}`);
        return;
    }
    if (cli.mode === "list-profiles") {
        const profiles = (0, chrome_profiles_js_1.listChromeProfiles)();
        if (profiles.length === 0) {
            console.log("No Chrome profiles found.");
        }
        else {
            for (const p of profiles) {
                const label = p.accountName ?? p.name;
                console.log(`${p.directory}: ${label}`);
            }
        }
        return;
    }
    if (cli.mode === "import-cookies") {
        const result = await (0, import_cookies_js_1.importCookiesCommand)({
            url: cli.url,
            profile: cli.profile,
            output: cli.output,
            outputRoot: process.cwd(),
        });
        console.log(`Imported ${result.count} cookies to ${result.outputPath}`);
        return;
    }
    const extensionsDir = node_path_1.default.resolve("extensions");
    const cookiesDir = dependencies.cookiesDir ?? node_path_1.default.resolve("cookies");
    const cookies = await resolveStartupCookies(cli, {
        cookiesDir,
        loadCookies: dependencies.loadCookies,
        readChromeCookies: dependencies.readChromeCookies,
    });
    const prepareExtensionsFn = dependencies.prepareExtensions ?? extension_js_1.prepareExtensions;
    const readConfigFn = dependencies.readConfig ?? config_js_1.readConfig;
    const config = readConfigFn(resolvedConfigPath);
    const engine = (0, config_js_1.resolveEngine)({
        cliEngine: cli.engine,
        config,
    });
    const launchPersistentContext = selectLaunchPersistentContext(engine, dependencies);
    const makeTempDir = dependencies.makeTempDir ?? node_fs_1.default.mkdtempSync;
    const makeDir = dependencies.makeDir ?? node_fs_1.default.mkdirSync;
    const writeFile = dependencies.writeFile ?? node_fs_1.default.writeFileSync;
    // Prepare extensions from zips
    const extensionPaths = await prepareExtensionsFn(extensionsDir);
    // Build chromium args
    const args = [];
    if (extensionPaths.length > 0) {
        const joined = extensionPaths.join(",");
        args.push(`--disable-extensions-except=${joined}`);
        args.push(`--load-extension=${joined}`);
    }
    // Persistent context is required for Chrome extensions to load
    const userDataDir = makeTempDir(node_path_1.default.join(node_os_1.default.tmpdir(), "vilnius-profile-"));
    // Enable developer mode for extensions in the fresh profile
    const defaultDir = node_path_1.default.join(userDataDir, "Default");
    makeDir(defaultDir, { recursive: true });
    writeFile(node_path_1.default.join(defaultDir, "Preferences"), JSON.stringify({
        extensions: { ui: { developer_mode: true } },
    }));
    const launchOptions = buildLaunchOptions(engine, cli.headless, args, dependencies);
    const context = await launchPersistentContext(userDataDir, launchOptions);
    // Inject cookies
    if (cookies.length > 0) {
        await context.addCookies(cookies);
        console.log(`Injected ${cookies.length} cookies`);
    }
    console.log("Browser running. Ctrl+C to exit.");
    // Keep alive until browser closes or process is killed
    const browser = context.browser();
    let onSigint;
    let onSigterm;
    const handleSignal = () => {
        console.log("\nShutting down...");
    };
    try {
        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            };
            onSigint = () => {
                handleSignal();
                finish();
            };
            onSigterm = () => {
                handleSignal();
                finish();
            };
            context.on("close", finish);
            if (browser)
                browser.on("disconnected", finish);
            process.on("SIGINT", onSigint);
            process.on("SIGTERM", onSigterm);
        });
    }
    finally {
        if (onSigint) {
            process.removeListener("SIGINT", onSigint);
        }
        if (onSigterm) {
            process.removeListener("SIGTERM", onSigterm);
        }
    }
    await context.close().catch(() => { });
}
function selectLaunchPersistentContext(engine, dependencies) {
    if (engine === "patchright") {
        return (dependencies.patchrightLaunchPersistentContext ??
            dependencies.launchPersistentContext ??
            patchright_1.chromium.launchPersistentContext.bind(patchright_1.chromium));
    }
    return (dependencies.playwrightLaunchPersistentContext ??
        dependencies.launchPersistentContext ??
        playwright_1.chromium.launchPersistentContext.bind(playwright_1.chromium));
}
function buildLaunchOptions(engine, headless, args, dependencies) {
    if (engine === "patchright") {
        const executablePath = dependencies.patchrightExecutablePath ??
            patchright_1.chromium.executablePath.bind(patchright_1.chromium);
        return {
            headless,
            executablePath: executablePath(),
            args,
        };
    }
    return {
        headless,
        channel: "chromium",
        args,
    };
}
if (require.main === module) {
    main().catch((err) => {
        if (err &&
            typeof err === "object" &&
            "code" in err &&
            err.code === "commander.helpDisplayed") {
            process.exit(0);
        }
        console.error(err);
        process.exit(1);
    });
}
