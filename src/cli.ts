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

export type ListProfilesMode = {
  mode: "list-profiles";
};

export type CliConfig = RunModeConfig | ImportCookiesConfig | ListProfilesMode;

function parseChromeBrowser(value: string): "chrome" {
  if (value !== "chrome") {
    throw new Error(`unsupported browser: ${value}`);
  }

  return "chrome";
}

function parseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`invalid site URL: ${value}`);
    }
    return value;
  } catch {
    throw new Error(`invalid URL: ${value}`);
  }
}

function silenceCommanderStderr(command: Command): Command {
  return command.configureOutput({
    writeErr: () => undefined,
  });
}

function addImportCookiesCommand(program: Command): Command {
  const importCommand = silenceCommanderStderr(program.command("import-cookies"));

  importCommand
    .summary("import Chrome cookies into cookies/")
    .requiredOption(
      "--browser <browser>",
      "browser to import cookies from (chrome only)",
      parseChromeBrowser
    )
    .requiredOption("--url <url>", "HTTP(S) site URL to scope Chrome cookies", parseUrl)
    .option("--chrome-profile <profile>", "Chrome profile name")
    .option("--output <output>", "output file path");

  return importCommand;
}

function buildRunModeProgram() {
  const program = silenceCommanderStderr(new Command());

  program
    .exitOverride()
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .showHelpAfterError()
    .name("hedlis")
    .description("Launch Patchright with the required OpenCLI extension and optional Chrome cookies.")
    .usage("[options] [command]")
    .option("--headless", "run without opening a browser window")
    .option("--cookies-from-browser <browser>", "load cookies from Chrome for this run", parseChromeBrowser)
    .option("--cookie-url <url>", "HTTP(S) site URL to scope Chrome cookies", parseUrl)
    .option("--chrome-profile <profile>", "Chrome profile name");

  program.addHelpText(
    "after",
    `
Commands:
  import-cookies  import cookies from Chrome into cookies/
  list-profiles   list available Chrome profiles

Examples:
  hedlis --headless
  hedlis --cookies-from-browser chrome --cookie-url https://x.com
  hedlis import-cookies --browser chrome --url https://x.com --chrome-profile "Profile 2"

Required extension:
  hedlis always needs extensions/opencli-extension.zip. bun install fetches it,
  and startup re-downloads it automatically if the archive is missing or invalid.
`
  );

  return program;
}

function buildImportCookiesProgram() {
  const program = silenceCommanderStderr(new Command());

  program
    .exitOverride()
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .showHelpAfterError()
    .name("hedlis")
    .description("Import Chrome cookies into cookies/ for repeatable hedlis runs.");

  const importCommand = addImportCookiesCommand(program);

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
  const { program } = buildImportCookiesProgram();

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

  if (argv.slice(2)[0] === "config") {
    throw new Error("unknown command: config");
  }

  if (argv.slice(2)[0] === "list-profiles") {
    return { mode: "list-profiles" };
  }

  return parseRunMode(argv);
}

export function isHeadlessEnabled(argv: string[]): boolean {
  try {
    const parsed = parseCli(argv);
    return parsed.mode === "run" ? parsed.headless : false;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "commander.helpDisplayed"
    ) {
      process.exit(0);
    }

    throw error;
  }
}
