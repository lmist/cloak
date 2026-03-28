"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCli = parseCli;
exports.isHeadlessEnabled = isHeadlessEnabled;
const commander_1 = require("commander");
const config_js_1 = require("./config.js");
function parseChromeBrowser(value) {
    if (value !== "chrome") {
        throw new Error(`unsupported browser: ${value}`);
    }
    return "chrome";
}
function parseConfigKey(value) {
    if (value !== "engine") {
        throw new Error(`unsupported config key: ${value}`);
    }
    return value;
}
function parseUrl(value) {
    try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error(`invalid site URL: ${value}`);
        }
        return value;
    }
    catch {
        throw new Error(`invalid URL: ${value}`);
    }
}
function silenceCommanderStderr(command) {
    return command.configureOutput({
        writeErr: () => undefined,
    });
}
function addImportCookiesCommand(program) {
    const importCommand = silenceCommanderStderr(program.command("import-cookies"));
    importCommand
        .requiredOption("--browser <browser>", "browser to import cookies from (chrome only)", parseChromeBrowser)
        .requiredOption("--url <url>", "HTTP(S) site URL to scope Chrome cookies", parseUrl)
        .option("--chrome-profile <profile>", "Chrome profile name")
        .option("--output <output>", "output file path");
    return importCommand;
}
function buildRunModeProgram() {
    const program = silenceCommanderStderr(new commander_1.Command());
    program
        .exitOverride()
        .allowUnknownOption(false)
        .allowExcessArguments(false)
        .name("hedlis")
        .option("--engine <engine>", "browser engine to use (playwright or patchright)", config_js_1.parseEngine)
        .option("--headless", "run headless")
        .option("--cookies-from-browser <browser>", "load cookies from Chrome", parseChromeBrowser)
        .option("--cookie-url <url>", "HTTP(S) site URL to scope Chrome cookies", parseUrl)
        .option("--chrome-profile <profile>", "Chrome profile name");
    program.addHelpText("after", "\nCommands:\n  import-cookies  import cookies from Chrome into cookies/\n  list-profiles   list available Chrome profiles\n  config          get or set persistent CLI defaults");
    return program;
}
function buildImportCookiesProgram() {
    const program = silenceCommanderStderr(new commander_1.Command());
    program
        .exitOverride()
        .allowUnknownOption(false)
        .allowExcessArguments(false)
        .name("hedlis");
    const importCommand = addImportCookiesCommand(program);
    return { program, importCommand };
}
function parseConfigMode(argv) {
    const args = argv.slice(2);
    if (args[0] !== "config") {
        throw new Error("config mode requires the config subcommand");
    }
    if (args[1] === "path" && args.length === 2) {
        return { mode: "config-path" };
    }
    if (args[1] === "get" && args.length === 3) {
        return {
            mode: "config-get",
            key: parseConfigKey(args[2]),
        };
    }
    if (args[1] === "set" && args.length === 4) {
        return {
            mode: "config-set",
            key: parseConfigKey(args[2]),
            value: (0, config_js_1.parseEngine)(args[3]),
        };
    }
    throw new Error("usage: hedlis config <get|set|path> ...");
}
function parseRunMode(argv) {
    const program = buildRunModeProgram();
    const options = program.parse(argv, { from: "node" }).opts();
    if (options.cookiesFromBrowser && !options.cookieUrl) {
        throw new Error("--cookie-url is required when --cookies-from-browser is used");
    }
    if (!options.cookiesFromBrowser && (options.cookieUrl || options.chromeProfile)) {
        throw new Error("--cookie-url and --chrome-profile require --cookies-from-browser");
    }
    const browserCookies = options.cookiesFromBrowser
        ? {
            browser: options.cookiesFromBrowser,
            url: options.cookieUrl,
            ...(options.chromeProfile ? { profile: options.chromeProfile } : {}),
        }
        : undefined;
    return browserCookies
        ? {
            mode: "run",
            headless: Boolean(options.headless),
            ...(options.engine ? { engine: options.engine } : {}),
            browserCookies,
        }
        : {
            mode: "run",
            headless: Boolean(options.headless),
            ...(options.engine ? { engine: options.engine } : {}),
        };
}
function parseImportCookiesMode(argv) {
    const { program, importCommand } = buildImportCookiesProgram();
    const parsed = program.parse(argv, { from: "node" });
    const parsedImportCommand = parsed.commands[0];
    if (!parsedImportCommand) {
        throw new Error("import-cookies command requires a subcommand");
    }
    const options = parsedImportCommand.opts();
    return {
        mode: "import-cookies",
        browser: options.browser,
        url: options.url,
        ...(options.chromeProfile ? { profile: options.chromeProfile } : {}),
        ...(options.output ? { output: options.output } : {}),
    };
}
function parseCli(argv) {
    if (argv.slice(2)[0] === "import-cookies") {
        return parseImportCookiesMode(argv);
    }
    if (argv.slice(2)[0] === "config") {
        return parseConfigMode(argv);
    }
    if (argv.slice(2)[0] === "list-profiles") {
        return { mode: "list-profiles" };
    }
    return parseRunMode(argv);
}
function isHeadlessEnabled(argv) {
    try {
        const parsed = parseCli(argv);
        return parsed.mode === "run" ? parsed.headless : false;
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "commander.helpDisplayed") {
            process.exit(0);
        }
        throw error;
    }
}
