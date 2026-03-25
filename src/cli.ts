import { Command } from "commander";

export type RunModeConfig = {
  mode: "run";
  headless: boolean;
  browserCookies?: {
    browser: "chrome";
    url: string;
    profile?: string;
  };
};

export type ImportCookiesConfig = {
  mode: "import-cookies";
  browser: "chrome";
  url: string;
  profile?: string;
  output?: string;
};

export type CliConfig = RunModeConfig | ImportCookiesConfig;

function parseChromeBrowser(value: string): "chrome" {
  if (value !== "chrome") {
    throw new Error(`unsupported browser: ${value}`);
  }

  return "chrome";
}

function silenceCommanderOutput(command: Command): Command {
  return command.configureOutput({
    writeErr: () => undefined,
    writeOut: () => undefined,
  });
}

function isHelpRequested(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function buildRunModeProgram() {
  const program = silenceCommanderOutput(new Command());

  program
    .exitOverride()
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .option("--headless", "run headless")
    .option("--cookies-from-browser <browser>", "load cookies from a browser", parseChromeBrowser)
    .option("--cookie-url <url>", "site URL to scope browser cookies")
    .option("--chrome-profile <profile>", "Chrome profile name");

  return program;
}

function buildImportCookiesProgram() {
  const program = silenceCommanderOutput(new Command());

  program
    .exitOverride()
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .name("hedlis");

  const importCommand = silenceCommanderOutput(program.command("import-cookies"));

  importCommand
    .requiredOption("--browser <browser>", "browser to import cookies from", parseChromeBrowser)
    .requiredOption("--url <url>", "site URL to scope browser cookies")
    .option("--chrome-profile <profile>", "Chrome profile name")
    .option("--output <output>", "output file path");

  return { program, importCommand };
}

function parseRunMode(argv: string[]): RunModeConfig {
  const program = buildRunModeProgram();

  const options = program.parse(argv, { from: "node" }).opts<{
    headless?: boolean;
    cookiesFromBrowser?: "chrome";
    cookieUrl?: string;
    chromeProfile?: string;
  }>();

  if (options.cookiesFromBrowser && !options.cookieUrl) {
    throw new Error("--cookie-url is required when --cookies-from-browser is used");
  }

  if (!options.cookiesFromBrowser && (options.cookieUrl || options.chromeProfile)) {
    throw new Error("--cookie-url and --chrome-profile require --cookies-from-browser");
  }

  const browserCookies = options.cookiesFromBrowser
    ? {
        browser: options.cookiesFromBrowser,
        url: options.cookieUrl as string,
        ...(options.chromeProfile ? { profile: options.chromeProfile } : {}),
      }
    : undefined;

  return browserCookies
    ? {
        mode: "run",
        headless: Boolean(options.headless),
        browserCookies,
      }
    : {
        mode: "run",
        headless: Boolean(options.headless),
      };
}

function parseImportCookiesMode(argv: string[]): ImportCookiesConfig {
  const { program, importCommand } = buildImportCookiesProgram();

  const parsed = program.parse(argv, { from: "node" });
  const parsedImportCommand = parsed.commands[0];

  if (!parsedImportCommand) {
    throw new Error("import-cookies command requires a subcommand");
  }

  const options = parsedImportCommand.opts<{
    browser: "chrome";
    url: string;
    chromeProfile?: string;
    output?: string;
  }>();

  return {
    mode: "import-cookies",
    browser: options.browser,
    url: options.url,
    ...(options.chromeProfile ? { profile: options.chromeProfile } : {}),
    ...(options.output ? { output: options.output } : {}),
  };
}

export function parseCli(argv: string[]): CliConfig {
  if (argv.slice(2)[0] === "import-cookies") {
    return parseImportCookiesMode(argv);
  }

  return parseRunMode(argv);
}

export function isHeadlessEnabled(argv: string[]): boolean {
  if (isHelpRequested(argv)) {
    if (argv.slice(2)[0] === "import-cookies") {
      const { importCommand } = buildImportCookiesProgram();
      process.stdout.write(importCommand.helpInformation());
    } else {
      process.stdout.write(buildRunModeProgram().helpInformation());
    }

    process.exit(0);
  }

  const parsed = parseCli(argv);
  return parsed.mode === "run" ? parsed.headless : false;
}
