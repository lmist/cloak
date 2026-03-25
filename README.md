# hedlis

Launches Playwright's bundled Chromium with browser extensions and cookies pre-loaded. Runs until you kill it.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
hedlis
hedlis --headless
```

### Extensions

Drop `.zip` files into `extensions/`. Each zip should contain a Chrome extension (with `manifest.json` at root or one level deep). They get unzipped to a temp dir and loaded into Chromium on launch.

### Cookies

Drop `.json` files into `cookies/` - one file per site, or however you want to organize them. The loader accepts both Playwright cookie JSON and common browser-export JSON, and normalizes browser-export fields automatically.

Playwright-format example:

```json
[
  {
    "name": "session_id",
    "value": "abc123",
    "domain": ".example.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "Lax",
    "expires": 1742860800
  }
]
```

All cookie files get merged and injected into the browser context on startup.

### Chrome Cookie Workflows

Browser-cookie access is always explicit. Hedlis only reads cookies from Chrome when you ask for it.

Import cookies from a Chrome profile into `cookies/`:

```bash
hedlis import-cookies --browser chrome --url https://example.com
hedlis import-cookies --browser chrome --url https://example.com --chrome-profile "Profile 2"
```

Load Chrome cookies at runtime for a single launch:

```bash
hedlis --cookies-from-browser chrome --cookie-url https://example.com
hedlis --cookies-from-browser chrome --cookie-url https://example.com --chrome-profile "Profile 2"
```

Use `--chrome-profile` when you want a specific Chrome profile. For persisted cookies, a closed Chrome instance is preferred because it usually leaves the freshest on-disk cookie state available.

Only Chrome is supported for browser-cookie access.

### Stopping

Ctrl+C or close the browser window.
