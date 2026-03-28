# Usage

## Install and build

```bash
bun install
bunx patchright install chromium
bun run build
```

## Import cookies and launch

```bash
hedlis import-cookies --browser chrome --url https://instagram.com --chrome-profile "Profile 7"
hedlis
```

## One-off runtime cookies

```bash
hedlis --cookies-from-browser chrome --cookie-url https://x.com
```

## List Chrome profiles

```bash
hedlis list-profiles
```
