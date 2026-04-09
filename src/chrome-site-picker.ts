import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";
import type { ChromeProfileSites, ChromeSite } from "./chrome-profile-sites.js";

type ChromeSiteSelection = {
  profile: ChromeProfileSites;
  site: ChromeSite;
};

type PickerStage = "profiles" | "sites";

type PickerOptions = {
  profiles: ChromeProfileSites[];
  initialProfileDirectory?: string;
  lockProfile?: boolean;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
};

export function filterChromeProfilesForQuery(
  profiles: ChromeProfileSites[],
  query: string
): ChromeProfileSites[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return profiles;
  }

  return profiles.filter((profile) =>
    [
      profile.directory,
      profile.name,
      profile.accountName,
      ...profile.sites.map((site) => site.host),
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  );
}

export function filterChromeSitesForQuery(
  sites: ChromeSite[],
  query: string
): ChromeSite[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return sites;
  }

  return sites.filter((site) => site.host.toLowerCase().includes(normalizedQuery));
}

export function clampSelectionIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, total - 1));
}

export async function runChromeSitePicker(
  options: PickerOptions
): Promise<ChromeSiteSelection | undefined> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Interactive selection requires a TTY");
  }

  const initialProfile = options.initialProfileDirectory
    ? options.profiles.find(
        (profile) => profile.directory === options.initialProfileDirectory
      )
    : undefined;
  let stage: PickerStage = initialProfile ? "sites" : "profiles";
  let activeProfile = initialProfile;
  let query = "";
  let selectedIndex = 0;
  let scrollOffset = 0;

  emitKeypressEvents(stdin);

  return new Promise((resolve) => {
    const render = () => {
      const pageSize = Math.max(6, (stdout.rows ?? 24) - 8);
      const visibleProfiles = filterChromeProfilesForQuery(options.profiles, query);
      const visibleSites = activeProfile
        ? filterChromeSitesForQuery(activeProfile.sites, query)
        : [];
      const items = stage === "profiles" ? visibleProfiles : visibleSites;

      selectedIndex = clampSelectionIndex(selectedIndex, items.length);
      scrollOffset = adjustScrollOffset({
        scrollOffset,
        selectedIndex,
        pageSize,
      });

      const visibleItems = items.slice(scrollOffset, scrollOffset + pageSize);
      const lines = [
        chalk.bold.cyan(
          stage === "profiles"
            ? "Chrome Profiles"
            : `Cookie Sites: ${activeProfile?.accountName ?? activeProfile?.name ?? activeProfile?.directory}`
        ),
        chalk.dim(
          stage === "profiles"
            ? "Search profiles and press Enter to inspect their cookie-bearing sites."
            : `Pick a site from ${activeProfile?.directory}.`
        ),
        "",
        `${chalk.bold("Search")}: ${
          query.length > 0 ? query : chalk.dim("type to filter")
        }`,
        "",
      ];

      if (visibleItems.length === 0) {
        lines.push(chalk.yellow("No matches."));
      } else {
        visibleItems.forEach((item, offset) => {
          const isSelected = scrollOffset + offset === selectedIndex;
          const line =
            stage === "profiles"
              ? formatProfileRow(item as ChromeProfileSites)
              : formatSiteRow(item as ChromeSite);

          lines.push(isSelected ? chalk.black.bgCyan(` ${line} `) : ` ${line}`);
        });
      }

      lines.push("");
      lines.push(
        chalk.dim(
          stage === "sites" && !options.lockProfile
            ? "↑/↓ or j/k move  Enter select  Backspace delete  Esc back  q quit"
            : "↑/↓ or j/k move  Enter select  Backspace delete  q quit"
        )
      );

      stdout.write("\x1b[2J\x1b[H" + lines.join("\n"));
    };

    const cleanup = () => {
      stdin.removeListener("keypress", onKeypress);
      stdout.removeListener("resize", render);

      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }

      stdin.pause();
      stdout.write("\x1b[?25h\x1b[?1049l");
    };

    const finish = (selection?: ChromeSiteSelection) => {
      cleanup();
      resolve(selection);
    };

    const onKeypress = (input: string, key: { ctrl?: boolean; name?: string }) => {
      const visibleProfiles = filterChromeProfilesForQuery(options.profiles, query);
      const visibleSites = activeProfile
        ? filterChromeSitesForQuery(activeProfile.sites, query)
        : [];
      const items = stage === "profiles" ? visibleProfiles : visibleSites;

      if (key.ctrl && key.name === "c") {
        finish();
        return;
      }

      if (input === "q") {
        finish();
        return;
      }

      switch (key.name) {
        case "up":
          selectedIndex = clampSelectionIndex(selectedIndex - 1, items.length);
          render();
          return;
        case "down":
          selectedIndex = clampSelectionIndex(selectedIndex + 1, items.length);
          render();
          return;
        case "pageup":
          selectedIndex = clampSelectionIndex(selectedIndex - 10, items.length);
          render();
          return;
        case "pagedown":
          selectedIndex = clampSelectionIndex(selectedIndex + 10, items.length);
          render();
          return;
        case "backspace":
          if (query.length > 0) {
            query = query.slice(0, -1);
            selectedIndex = 0;
            scrollOffset = 0;
            render();
          }
          return;
        case "left":
        case "escape":
          if (stage === "sites" && !options.lockProfile) {
            stage = "profiles";
            activeProfile = undefined;
            query = "";
            selectedIndex = 0;
            scrollOffset = 0;
            render();
            return;
          }

          finish();
          return;
        case "return":
        case "enter":
          if (stage === "profiles") {
            const profile = visibleProfiles[selectedIndex];

            if (!profile) {
              return;
            }

            activeProfile = profile;
            stage = "sites";
            query = "";
            selectedIndex = 0;
            scrollOffset = 0;
            render();
            return;
          }

          if (!activeProfile) {
            return;
          }

          const site = visibleSites[selectedIndex];

          if (!site) {
            return;
          }

          finish({
            profile: activeProfile,
            site,
          });
          return;
        default:
          break;
      }

      if (input === "j") {
        selectedIndex = clampSelectionIndex(selectedIndex + 1, items.length);
        render();
        return;
      }

      if (input === "k") {
        selectedIndex = clampSelectionIndex(selectedIndex - 1, items.length);
        render();
        return;
      }

      if (input.length === 1 && !key.ctrl) {
        query += input;
        selectedIndex = 0;
        scrollOffset = 0;
        render();
      }
    };

    stdout.write("\x1b[?1049h\x1b[?25l");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("keypress", onKeypress);
    stdout.on("resize", render);
    render();
  });
}

function adjustScrollOffset(options: {
  scrollOffset: number;
  selectedIndex: number;
  pageSize: number;
}): number {
  if (options.selectedIndex < options.scrollOffset) {
    return options.selectedIndex;
  }

  if (options.selectedIndex >= options.scrollOffset + options.pageSize) {
    return options.selectedIndex - options.pageSize + 1;
  }

  return options.scrollOffset;
}

function formatProfileRow(profile: ChromeProfileSites): string {
  const label = profile.accountName ?? profile.name;
  const countLabel = `${profile.sites.length} ${profile.sites.length === 1 ? "site" : "sites"}`;

  return [
    chalk.bold(profile.directory),
    chalk.dim("·"),
    label,
    chalk.dim(`(${countLabel})`),
  ].join(" ");
}

function formatSiteRow(site: ChromeSite): string {
  return [chalk.bold(site.host), chalk.dim(site.url)].join(" ");
}
