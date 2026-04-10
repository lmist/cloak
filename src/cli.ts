import yargs, { type Argv, type ArgumentsCamelCase } from "yargs"
import { formatHeading } from "./output.js"

type HelpMode = {
  mode: "help"
  text: string
}

type VersionMode = {
  mode: "version"
}

export type RunModeConfig = {
  mode: "run"
  headless: boolean
  daemon: boolean
  persistCookies: boolean
  consent: boolean
  profile?: string
  cookieUrls: string[]
}

type DaemonStatusMode = {
  mode: "daemon-status"
}

type DaemonStopMode = {
  mode: "daemon-stop"
}

type DaemonRestartMode = {
  mode: "daemon-restart"
}

type DaemonLogsMode = {
  mode: "daemon-logs"
}

type ProfileListMode = {
  mode: "profile-list"
}

type ProfileShowMode = {
  mode: "profile-show"
}

type ProfileUseMode = {
  mode: "profile-use"
  profile: string
  consent: boolean
}

type SitesListMode = {
  mode: "sites-list"
  limit: number
  noPager: boolean
  consent: boolean
}

type StorageShowMode = {
  mode: "storage-show"
}

type StorageDestroyMode = {
  mode: "storage-destroy"
}

type CliConfig =
  | HelpMode
  | VersionMode
  | RunModeConfig
  | DaemonStatusMode
  | DaemonStopMode
  | DaemonRestartMode
  | DaemonLogsMode
  | ProfileListMode
  | ProfileShowMode
  | ProfileUseMode
  | SitesListMode
  | StorageShowMode
  | StorageDestroyMode

function parseUrl(value: string): string {
  try {
    const parsed = new URL(value)

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`invalid site URL: ${value}`)
    }

    return parsed.toString()
  } catch {
    throw new Error(`invalid URL: ${value}`)
  }
}

function normalizeUrls(values: string | string[] | undefined): string[] {
  if (!values) {
    return []
  }

  const urls = Array.isArray(values) ? values : [values]
  const normalized = urls.map(parseUrl)

  return [...new Set(normalized)]
}

function parseLimit(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("--limit must be a positive integer")
  }

  return value
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
        throw error
      }

      throw new Error(message)
    })
}

function isHelpFlag(value: string | undefined): boolean {
  return value === "-h" || value === "--help"
}

function rootEpilog(): string {
  return `${formatHeading("Examples:")}
  cloak profile list
  cloak profile use "Profile 7"
  cloak profile show
  cloak sites list
  cloak run
  cloak daemon start --profile "Profile 7" --persist-cookies --consent --cookie-url https://x.com
  cloak daemon status
  cloak daemon logs
  cloak storage show
  cloak storage destroy
  cloak version

${formatHeading("Storage:")}
  cloak stores state in ~/.config/cloak/state.sqlite
  cloak stores daemon logs and the pinned OpenCLI extension under ~/.cache/cloak/
`
}

function buildRootProgram(args: string[] = []): Argv {
  return createParser(args, "cloak")
    .usage("$0 <command>")
    .command("run", "launch Patchright headless by default")
    .command("daemon", "start, inspect, stop, restart, or print the managed daemon log")
    .command("profile", "list, show, or select a Chrome profile")
    .command("sites", "list cookie-bearing site URLs for the active profile")
    .command("storage", "inspect or destroy cloak storage")
    .command("version", "print the installed cloak version")
    .epilog(rootEpilog())
}

function rootHelpText(): string {
  return `Usage: cloak <command>

Commands:
  cloak run                           launch Patchright headless by default
  cloak daemon start                  start the managed daemon
  cloak daemon status                 inspect the managed daemon
  cloak daemon stop                   stop the managed daemon
  cloak daemon restart                restart the managed daemon
  cloak daemon logs                   print the managed daemon log
  cloak profile list                  list available Chrome profiles
  cloak profile show                  show the saved default Chrome profile
  cloak profile use <name>            save the default Chrome profile
  cloak sites list                    list Chrome cookie URLs for the active profile
  cloak storage show                  show the cloak storage paths
  cloak storage destroy               destroy cloak storage after confirmation
  cloak version                       print the installed cloak version

Options:
  -h, --help                          Show help
  -v, --version                       Show version

${rootEpilog()}`
}

function runEpilog(): string {
  return `${formatHeading("Examples:")}
  cloak run
  cloak run --window
  cloak run --cookie-url https://x.com --profile "Profile 7"
  cloak run --persist-cookies --consent --cookie-url https://x.com

${formatHeading("Related:")}
  cloak daemon start [same options as run]

${formatHeading("Storage:")}
  --persist-cookies remembers cookie URLs for the chosen profile
`
}

function buildRunProgram(args: string[] = []): Argv {
  return createParser(args, "cloak run")
    .usage("$0 [options]")
    .option("window", {
      alias: "w",
      type: "boolean",
      description: "open a visible browser window",
    })
    .option("profile", {
      type: "string",
      description: "Chrome profile directory name",
    })
    .option("cookie-url", {
      type: "string",
      array: true,
      description: "HTTP(S) site URL to import cookies from",
      coerce: normalizeUrls,
    })
    .option("persist-cookies", {
      type: "boolean",
      description: "remember the provided --cookie-url values for this profile",
    })
    .option("consent", {
      type: "boolean",
      description: "create ~/.config/cloak without prompting",
    })
    .check((options: ArgumentsCamelCase<Record<string, unknown>>) => {
      const cookieUrls = Array.isArray(options.cookieUrl)
        ? (options.cookieUrl as string[])
        : []

      if (options.persistCookies && cookieUrls.length === 0) {
        throw new Error("--persist-cookies requires at least one --cookie-url")
      }

      return true
    })
    .epilog(runEpilog())
}

function runHelpText(): string {
  return `Usage: cloak run [options]

Options:
  -h, --help               Show help
  -w, --window             open a visible browser window
  --profile <profile>      Chrome profile directory name
  --cookie-url <url>       HTTP(S) site URL to import cookies from
  --persist-cookies        remember the provided --cookie-url values
  --consent                create ~/.config/cloak without prompting

${runEpilog()}`
}

function buildDaemonProgram(args: string[] = []): Argv {
  return createParser(args, "cloak daemon")
    .usage("$0 <command>")
    .command("start", "start the managed daemon")
    .command("status", "inspect the managed daemon")
    .command("stop", "stop the managed daemon")
    .command("restart", "restart the managed daemon")
    .command("logs", "print the managed daemon log")
}

function daemonHelpText(): string {
  return `Usage: cloak daemon <command>

Commands:
  cloak daemon start      start the managed daemon
  cloak daemon status     inspect the managed daemon
  cloak daemon stop       stop the managed daemon
  cloak daemon restart    restart the managed daemon
  cloak daemon logs       print the managed daemon log

Options:
  -h, --help              Show help
`
}

function buildDaemonStartProgram(args: string[] = []): Argv {
  return createParser(args, "cloak daemon start")
    .usage("$0 [options]")
    .option("window", {
      alias: "w",
      type: "boolean",
      description: "open a visible browser window",
    })
    .option("profile", {
      type: "string",
      description: "Chrome profile directory name",
    })
    .option("cookie-url", {
      type: "string",
      array: true,
      description: "HTTP(S) site URL to import cookies from",
      coerce: normalizeUrls,
    })
    .option("persist-cookies", {
      type: "boolean",
      description: "remember the provided --cookie-url values for this profile",
    })
    .option("consent", {
      type: "boolean",
      description: "create ~/.config/cloak without prompting",
    })
    .check((options: ArgumentsCamelCase<Record<string, unknown>>) => {
      const cookieUrls = Array.isArray(options.cookieUrl)
        ? (options.cookieUrl as string[])
        : []

      if (options.persistCookies && cookieUrls.length === 0) {
        throw new Error("--persist-cookies requires at least one --cookie-url")
      }

      return true
    })
}

function daemonStartHelpText(): string {
  return `Usage: cloak daemon start [options]

Options:
  -h, --help               Show help
  -w, --window             open a visible browser window
  --profile <profile>      Chrome profile directory name
  --cookie-url <url>       HTTP(S) site URL to import cookies from
  --persist-cookies        remember the provided --cookie-url values
  --consent                create ~/.config/cloak without prompting
`
}

function buildZeroArgProgram(args: string[] = [], scriptName: string): Argv {
  return createParser(args, scriptName).usage("$0")
}

function zeroArgHelpText(usage: string): string {
  return `Usage: ${usage}

Options:
  -h, --help  Show help
`
}

function buildProfileProgram(args: string[] = []): Argv {
  return createParser(args, "cloak profile")
    .usage("$0 <command>")
    .command("list", "list available Chrome profiles")
    .command("show", "show the saved default Chrome profile")
    .command("use <profile>", "save the default Chrome profile")
}

function profileHelpText(): string {
  return `Usage: cloak profile <command>

Commands:
  cloak profile list         list available Chrome profiles
  cloak profile show         show the saved default Chrome profile
  cloak profile use <name>   save the default Chrome profile

Options:
  -h, --help                 Show help
`
}

function buildProfileUseProgram(args: string[] = []): Argv {
  return createParser(args, "cloak profile use")
    .usage("$0 <profile> [options]")
    .option("consent", {
      type: "boolean",
      description: "create ~/.config/cloak without prompting",
    })
}

function profileUseHelpText(): string {
  return `Usage: cloak profile use <profile> [options]

Options:
  -h, --help     Show help
  --consent      create ~/.config/cloak without prompting
`
}

function buildSitesProgram(args: string[] = []): Argv {
  return createParser(args, "cloak sites")
    .usage("$0 <command>")
    .command("list", "list Chrome cookie URLs for the active profile")
}

function sitesHelpText(): string {
  return `Usage: cloak sites <command>

Commands:
  cloak sites list  list Chrome cookie URLs for the active profile

Options:
  -h, --help        Show help
`
}

function buildSitesListProgram(args: string[] = []): Argv {
  return createParser(args, "cloak sites list")
    .usage("$0 [options]")
    .option("pager", {
      type: "boolean",
      default: true,
      description: "prompt for interactive selection after printing the list",
    })
    .option("limit", {
      alias: "l",
      type: "number",
      default: 100,
      description: "maximum number of URLs to print",
      coerce: parseLimit,
    })
    .option("consent", {
      type: "boolean",
      description: "create ~/.config/cloak without prompting",
    })
}

function sitesListHelpText(): string {
  return `Usage: cloak sites list [options]

Options:
  -h, --help           Show help
  -n, --no-pager       print without prompting for selection
  -l, --limit <count>  maximum number of URLs to print (default 100)
  --consent            create ~/.config/cloak without prompting
`
}

function buildStorageProgram(args: string[] = []): Argv {
  return createParser(args, "cloak storage")
    .usage("$0 <command>")
    .command("show", "show the cloak storage paths")
    .command("destroy", "destroy cloak storage after confirmation")
}

function storageHelpText(): string {
  return `Usage: cloak storage <command>

Commands:
  cloak storage show     show the cloak storage paths
  cloak storage destroy  destroy cloak storage after confirmation

Options:
  -h, --help             Show help
`
}

function parseRunMode(args: string[]): CliConfig {
  const parser = buildRunProgram(args)
  const options = parser.parseSync() as {
    help?: boolean
    window?: boolean
    profile?: string
    cookieUrl?: string[]
    persistCookies?: boolean
    consent?: boolean
  }

  if (options.help) {
    return {
      mode: "help",
      text: runHelpText(),
    }
  }

  return {
    mode: "run",
    headless: !Boolean(options.window),
    daemon: false,
    persistCookies: Boolean(options.persistCookies),
    consent: Boolean(options.consent),
    profile: options.profile,
    cookieUrls: options.cookieUrl ?? [],
  }
}

function parseDaemonStartMode(args: string[]): CliConfig {
  const parser = buildDaemonStartProgram(args)
  const options = parser.parseSync() as {
    help?: boolean
    window?: boolean
    profile?: string
    cookieUrl?: string[]
    persistCookies?: boolean
    consent?: boolean
  }

  if (options.help) {
    return {
      mode: "help",
      text: daemonStartHelpText(),
    }
  }

  return {
    mode: "run",
    headless: !Boolean(options.window),
    daemon: true,
    persistCookies: Boolean(options.persistCookies),
    consent: Boolean(options.consent),
    profile: options.profile,
    cookieUrls: options.cookieUrl ?? [],
  }
}

function parseProfileUseMode(args: string[]): CliConfig {
  const profile = String(args[0] ?? "").trim()

  if (!profile) {
    throw new Error("profile is required")
  }

  const parser = buildProfileUseProgram(args.slice(1))
  const options = parser.parseSync() as {
    help?: boolean
    consent?: boolean
  }

  if (options.help) {
    return {
      mode: "help",
      text: profileUseHelpText(),
    }
  }

  return {
    mode: "profile-use",
    profile,
    consent: Boolean(options.consent),
  }
}

function parseSitesListMode(args: string[]): CliConfig {
  const normalizedArgs = args.map((arg) => (arg === "-n" ? "--no-pager" : arg))
  const parser = buildSitesListProgram(normalizedArgs)
  const options = parser.parseSync() as {
    help?: boolean
    pager?: boolean
    limit?: number
    consent?: boolean
  }

  if (options.help) {
    return {
      mode: "help",
      text: sitesListHelpText(),
    }
  }

  return {
    mode: "sites-list",
    limit: options.limit ?? 100,
    noPager: options.pager === false,
    consent: Boolean(options.consent),
  }
}

function parseRootMode(args: string[]): never {
  buildRootProgram(args).parseSync()
  throw new Error("root mode parsing should not return")
}

export function parseCli(argv: string[]): CliConfig {
  const args = argv.slice(2)

  if (args.length === 0 || isHelpFlag(args[0])) {
    return {
      mode: "help",
      text: rootHelpText(),
    }
  }

  if (args[0] === "-v" || args[0] === "--version" || args[0] === "version") {
    return {
      mode: "version",
    }
  }

  if (args[0] === "run") {
    if (args.length === 2 && isHelpFlag(args[1])) {
      return {
        mode: "help",
        text: runHelpText(),
      }
    }

    return parseRunMode(args.slice(1))
  }

  if (args[0] === "daemon") {
    if (args.length === 1 || isHelpFlag(args[1])) {
      return {
        mode: "help",
        text: daemonHelpText(),
      }
    }

    if (args[1] === "start") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: daemonStartHelpText(),
        }
      }

      return parseDaemonStartMode(args.slice(2))
    }

    if (args[1] === "status") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak daemon status"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak daemon status").parseSync()
      return { mode: "daemon-status" }
    }

    if (args[1] === "stop") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak daemon stop"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak daemon stop").parseSync()
      return { mode: "daemon-stop" }
    }

    if (args[1] === "restart") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak daemon restart"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak daemon restart").parseSync()
      return { mode: "daemon-restart" }
    }

    if (args[1] === "logs") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak daemon logs"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak daemon logs").parseSync()
      return { mode: "daemon-logs" }
    }

    buildDaemonProgram(args.slice(1)).parseSync()
    throw new Error("daemon parsing should not return")
  }

  if (args[0] === "profile") {
    if (args.length === 1 || isHelpFlag(args[1])) {
      return {
        mode: "help",
        text: profileHelpText(),
      }
    }

    if (args[1] === "list") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak profile list"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak profile list").parseSync()
      return { mode: "profile-list" }
    }

    if (args[1] === "show") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak profile show"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak profile show").parseSync()
      return { mode: "profile-show" }
    }

    if (args[1] === "use") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: profileUseHelpText(),
        }
      }

      return parseProfileUseMode(args.slice(2))
    }

    buildProfileProgram(args.slice(1)).parseSync()
    throw new Error("profile parsing should not return")
  }

  if (args[0] === "sites") {
    if (args.length === 1 || isHelpFlag(args[1])) {
      return {
        mode: "help",
        text: sitesHelpText(),
      }
    }

    if (args[1] === "list") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: sitesListHelpText(),
        }
      }

      return parseSitesListMode(args.slice(2))
    }

    buildSitesProgram(args.slice(1)).parseSync()
    throw new Error("sites parsing should not return")
  }

  if (args[0] === "storage") {
    if (args.length === 1 || isHelpFlag(args[1])) {
      return {
        mode: "help",
        text: storageHelpText(),
      }
    }

    if (args[1] === "show") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak storage show"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak storage show").parseSync()
      return { mode: "storage-show" }
    }

    if (args[1] === "destroy") {
      if (args.length === 3 && isHelpFlag(args[2])) {
        return {
          mode: "help",
          text: zeroArgHelpText("cloak storage destroy"),
        }
      }

      buildZeroArgProgram(args.slice(2), "cloak storage destroy").parseSync()
      return { mode: "storage-destroy" }
    }

    buildStorageProgram(args.slice(1)).parseSync()
    throw new Error("storage parsing should not return")
  }

  return parseRootMode(args)
}

export function isHeadlessEnabled(argv: string[]): boolean {
  const parsed = parseCli(argv)
  return parsed.mode === "run" ? parsed.headless : false
}
