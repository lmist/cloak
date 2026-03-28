# hedlis

`hedlis` launches Patchright with the required OpenCLI extension and optional Chrome cookies already loaded.

## Install

```bash
bun install
bunx patchright install chromium
```

`bun install` always fetches `extensions/opencli-extension.zip` from the pinned OpenCLI release asset. `hedlis` also re-downloads that archive on startup if it is missing or invalid. The command does not run without it.

## Build

```bash
bun run build
```

This produces one compiled Bun executable at `dist/hedlis`.

## Quick Start

1. Find your Chrome profile:

```bash
hedlis list-profiles
```

2. Import cookies for a site:

```bash
hedlis import-cookies --browser chrome --url https://instagram.com --chrome-profile "Profile 7"
```

3. Launch the browser:

```bash
hedlis
```

Add `--headless` to run without opening a window.

## Runtime Layout

`hedlis` reads and writes from the current working directory:

- `extensions/opencli-extension.zip` is the required extension archive
- `cookies/` stores imported JSON cookies
- `downloads/` is where OpenCLI output lands

## Commands

```bash
hedlis
hedlis --headless
hedlis --cookies-from-browser chrome --cookie-url https://x.com
hedlis import-cookies --browser chrome --url https://x.com --chrome-profile "Profile 2"
hedlis list-profiles
hedlis --help
```

## Cookies

Import cookies into `cookies/` for repeatable runs:

```bash
hedlis import-cookies --browser chrome --url https://x.com
hedlis import-cookies --browser chrome --url https://x.com --chrome-profile "Profile 2"
```

Or inject them for a single session without saving to disk:

```bash
hedlis --cookies-from-browser chrome --cookie-url https://x.com
hedlis --cookies-from-browser chrome --cookie-url https://x.com --chrome-profile "Profile 2"
```

Known limitation:
`chrome-cookies-secure` may collapse same-name cookies across different paths or subdomains before `hedlis` sees them. If imported cookies look incomplete or login still fails, that may be the cause.

## Extension Guarantees

- The required archive is always `extensions/opencli-extension.zip`
- Install-time fetch uses `https://github.com/jackwener/opencli/releases/download/v1.5.5/opencli-extension.zip`
- Startup validates the archive before launch
- Missing or corrupt archives trigger an automatic repair download
- If the repair download fails, `hedlis` exits before opening Patchright

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
bun run src/main.ts --help
```

CI runs `bun install --frozen-lockfile`, `bun test`, `bun run typecheck`, and `bun run build`.
