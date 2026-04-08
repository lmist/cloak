import yargs, { type Argv, type ArgumentsCamelCase } from "yargs";
import { formatHeading } from "./output.js";

export type HelpMode = {
  mode: "help";
  text: string;
};

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

export type CliConfig =
  | HelpMode
  | RunModeConfig
  | ImportCookiesConfig
  | ListProfilesMode;

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

function createParser(args: string[], scriptName: string): Argv {
  return yargs(args)
    .scriptName(scriptName)
    .exitProcess(false)
    .help(false)
    .version(false)
    .showHelpOnFail(false)
    .strict()
    .strictCommands()
    .strictOptions()
    .wrap(100)
    .fail((message: string | undefined, error: Error | undefined) => {
      if (error) {
        throw error;
      }

      throw new Error(message);
    });
}

function rootEpilog(): string {
  return `${formatHeading("Examples:")}
  cloak profiles list
  cloak cookies import --browser chrome --url https://x.com --chrome-profile "Default"
  cloak run
  cloak run -w --cookies-from-browser chrome --cookie-url https://x.com

${formatHeading("Storage:")}
  cloak keeps cookies and the pinned OpenCLI extension under ~/.config/cloak/
`;
}

function buildRootProgram(args: string[] = []): Argv {
  return createParser(args, "cloak")
    .usage("$0 <command>")
    .command("run", "launch Patchright headless by default")
    .command("cookies import", "import Chrome cookies into ~/.config/cloak/cookies/")
    .command("profiles list", "list available Chrome profiles")
    .epilog(rootEpilog());
}

function rootHelpTextInternal(): string {
  return `Usage: cloak <command>

Commands:
  cloak run             launch Patchright headless by default
  cloak cookies import  import Chrome cookies into ~/.config/cloak/cookies/
  cloak profiles list   list available Chrome profiles

Options:
  -h, --help            Show help

${rootEpilog()}`;
}

function buildCookiesProgram(args: string[] = []): Argv {
  return createParser(args, "cloak cookies")
    .usage("$0 <command>")
    .command("import", "import Chrome cookies into ~/.config/cloak/cookies/");
}

function buildProfilesProgram(args: string[] = []): Argv {
  return createParser(args, "cloak profiles")
    .usage("$0 <command>")
    .command("list", "list available Chrome profiles");
}

function runEpilog(): string {
  return `${formatHeading("Examples:")}
  cloak run
  cloak run -w
  cloak run --cookies-from-browser chrome --cookie-url https://x.com

${formatHeading("Storage:")}
  cloak loads saved cookies from ~/.config/cloak/cookies/
`;
}

function buildRunProgram(args: string[] = []): Argv {
  return createParser(args, "cloak run")
    .usage("$0 [options]")
    .option("window", {
      alias: "w",
      type: "boolean",
      description: "open a visible browser window",
    })
    .option("cookies-from-browser", {
      type: "string",
      description: "load cookies from Chrome for this run",
      coerce: parseChromeBrowser,
    })
    .option("cookie-url", {
      type: "string",
      description: "HTTP(S) site URL to scope Chrome cookies",
      coerce: parseUrl,
    })
    .option("chrome-profile", {
      type: "string",
      description: "Chrome profile name",
    })
    .check((options: ArgumentsCamelCase<Record<string, unknown>>) => {
      if (options.cookiesFromBrowser && !options.cookieUrl) {
        throw new Error("--cookie-url is required when --cookies-from-browser is used");
      }

      if (!options.cookiesFromBrowser && (options.cookieUrl || options.chromeProfile)) {
        throw new Error("--cookie-url and --chrome-profile require --cookies-from-browser");
      }

      return true;
    })
    .epilog(runEpilog());
}

function runHelpText(): string {
  return `Usage: cloak run [options]

Options:
  -h, --help                          Show help
  -w, --window                        open a visible browser window
      --cookies-from-browser <browser>  load cookies from Chrome for this run
      --cookie-url <url>              HTTP(S) site URL to scope Chrome cookies
      --chrome-profile <profile>      Chrome profile name

${runEpilog()}`;
}

function buildImportCookiesProgram(args: string[] = []): Argv {
  return createParser(args, "cloak cookies import")
    .usage("$0 [options]")
    .option("browser", {
      type: "string",
      demandOption: true,
      description: "browser to import cookies from (chrome only)",
      coerce: parseChromeBrowser,
    })
    .option("url", {
      type: "string",
      demandOption: true,
      description: "HTTP(S) site URL to scope Chrome cookies",
      coerce: parseUrl,
    })
    .option("chrome-profile", {
      type: "string",
      description: "Chrome profile name",
    })
    .option("output", {
      type: "string",
      description: "output file path",
    });
}

function cookiesHelpText(): string {
  return `Usage: cloak cookies <command>

Commands:
  cloak cookies import  import Chrome cookies into ~/.config/cloak/cookies/

Options:
  -h, --help            Show help
`;
}

function importCookiesHelpText(): string {
  return `Usage: cloak cookies import [options]

Options:
  -h, --help                     Show help
      --browser <browser>        browser to import cookies from (chrome only)
      --url <url>                HTTP(S) site URL to scope Chrome cookies
      --chrome-profile <profile> Chrome profile name
      --output <output>          output file path
`;
}

function buildListProfilesProgram(args: string[] = []): Argv {
  return createParser(args, "cloak profiles list")
    .usage("$0");
}

function profilesHelpText(): string {
  return `Usage: cloak profiles <command>

Commands:
  cloak profiles list  list available Chrome profiles

Options:
  -h, --help           Show help
`;
}

function listProfilesHelpText(): string {
  return `Usage: cloak profiles list

Options:
  -h, --help  Show help
`;
}

function parseRootMode(args: string[]): never {
  buildRootProgram(args).parseSync();
  throw new Error("root mode parsing should not return");
}

function parseRunMode(args: string[]): CliConfig {
  const parser = buildRunProgram(args);
  const options = parser.parseSync() as {
    help?: boolean;
    window?: boolean;
    cookiesFromBrowser?: "chrome";
    cookieUrl?: string;
    chromeProfile?: string;
  };

  if (options.help) {
    return {
      mode: "help",
      text: runHelpText(),
    };
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
        headless: !Boolean(options.window),
        browserCookies,
      }
    : {
        mode: "run",
        headless: !Boolean(options.window),
      };
}

function parseImportCookiesMode(args: string[]): CliConfig {
  const parser = buildImportCookiesProgram(args);
  const options = parser.parseSync() as unknown as {
    help?: boolean;
    browser: "chrome";
    url: string;
    chromeProfile?: string;
    output?: string;
  };

  if (options.help) {
    return {
      mode: "help",
      text: importCookiesHelpText(),
    };
  }

  return {
    mode: "import-cookies",
    browser: options.browser,
    url: options.url,
    ...(options.chromeProfile ? { profile: options.chromeProfile } : {}),
    ...(options.output ? { output: options.output } : {}),
  };
}

function parseListProfilesMode(args: string[]): CliConfig {
  const parser = buildListProfilesProgram(args);
  const options = parser.parseSync() as {
    help?: boolean;
  };

  if (options.help) {
    return {
      mode: "help",
      text: listProfilesHelpText(),
    };
  }

  return { mode: "list-profiles" };
}

export function parseCli(argv: string[]): CliConfig {
  const args = argv.slice(2);

  if (args.length === 0) {
    return {
      mode: "help",
      text: rootHelpText(),
    };
  }

  if (args[0] === "-h" || args[0] === "--help") {
    return {
      mode: "help",
      text: rootHelpText(),
    };
  }

  if (args[0] === "run") {
    if (args.length === 2 && (args[1] === "-h" || args[1] === "--help")) {
      return {
        mode: "help",
        text: runHelpText(),
      };
    }

    return parseRunMode(args.slice(1));
  }

  if (args[0] === "cookies") {
    if (args.length === 1 || args[1] === "-h" || args[1] === "--help") {
      return {
        mode: "help",
        text: cookiesHelpText(),
      };
    }

    if (args[1] === "import") {
      if (args.length === 3 && (args[2] === "-h" || args[2] === "--help")) {
        return {
          mode: "help",
          text: importCookiesHelpText(),
        };
      }

      return parseImportCookiesMode(args.slice(2));
    }

    buildCookiesProgram(args.slice(1)).parseSync();
    throw new Error("cookies parsing should not return");
  }

  if (args[0] === "profiles") {
    if (args.length === 1 || args[1] === "-h" || args[1] === "--help") {
      return {
        mode: "help",
        text: profilesHelpText(),
      };
    }

    if (args[1] === "list") {
      if (args.length === 3 && (args[2] === "-h" || args[2] === "--help")) {
        return {
          mode: "help",
          text: listProfilesHelpText(),
        };
      }

      return parseListProfilesMode(args.slice(2));
    }

    buildProfilesProgram(args.slice(1)).parseSync();
    throw new Error("profiles parsing should not return");
  }

  return parseRootMode(args);
}

export function isHeadlessEnabled(argv: string[]): boolean {
  const parsed = parseCli(argv);
  return parsed.mode === "run" ? parsed.headless : false;
}

export function rootHelpText(): string {
  return rootHelpTextInternal();
}
