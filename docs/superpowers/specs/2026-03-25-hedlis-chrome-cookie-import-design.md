# Hedlis Chrome Cookie Import Design

**Goal:** Let `hedlis` import cookies from the user's installed Google Chrome profile for a specific site, but only when the user explicitly asks for it.

**Why:** The current app can only load cookie JSON files from `cookies/`. The new behavior should support two explicit workflows without turning browser-cookie access into a default or implicit fallback.

## Scope

- Support Google Chrome only
- Support a target site URL so cookie extraction is site-scoped
- Support selecting a Chrome profile such as `Default` or `Profile 2`
- Support both a persistent import workflow and a one-shot runtime workflow
- Keep the existing `cookies/*.json` loading behavior unchanged when browser-cookie flags are not used

## Non-Goals

- Support Firefox, Safari, Edge, Brave, or Chromium in this change
- Automatically read from a browser profile when cookies are otherwise missing
- Persist one-shot runtime cookies to disk
- Change the existing extension-loading or Playwright startup model

## CLI Design

Recommended durable workflow:

```bash
hedlis import-cookies --browser chrome --url https://x.com --chrome-profile "Profile 2"
```

One-shot runtime workflow:

```bash
hedlis --cookies-from-browser chrome --cookie-url https://x.com --chrome-profile "Profile 2"
```

Rules:

- Browser-cookie access is opt-in only
- `--browser chrome` is required for `import-cookies`
- `--url` is required for `import-cookies`
- `--cookies-from-browser chrome` requires `--cookie-url`
- `--chrome-profile` is optional for both flows
- Unsupported browsers fail with a CLI error
- The default import filename uses the parsed URL hostname, lowercased, without the port
- Default import output overwrites an existing file for the same hostname

## Behavior

`import-cookies` flow:

1. Parse the command with a proper TypeScript CLI parser
2. Read cookies from the user's installed Chrome profile for the requested URL
3. Normalize the returned cookies into the existing internal cookie shape
4. Write JSON to `cookies/<hostname>.json` by default, or to a user-provided output path

Runtime flag flow:

1. Parse the explicit browser-cookie flags during normal launch
2. Read and normalize cookies using the same Chrome adapter
3. Merge them with any cookies loaded from `cookies/*.json`
4. If the same cookie appears in both sources, the browser-imported cookie wins when `name`, `domain`, and `path` match exactly
5. Inject the merged cookie set into the Playwright context before startup continues
6. Do not write those cookies to disk

Default launch flow:

- If no browser-cookie flags are provided, `hedlis` only reads from `cookies/*.json`

## Implementation Shape

- Replace the current ad-hoc argument handling with `commander`
- Add a narrow Chrome cookie adapter around `chrome-cookies-secure`
- Keep Chrome-specific behavior isolated behind a small module so the rest of the app works with the existing cookie type
- Reuse the existing cookie normalization path for disk imports and runtime injection

## Data and Normalization

- Accept the cookie objects returned by the Chrome adapter
- Normalize them into the existing `Cookie` interface already used by Playwright injection
- Preserve the current JSON cookie loading behavior for files already in `cookies/`
- Runtime-imported cookies and file-imported cookies should go through the same normalized shape before use

## Failure Handling

- Missing required URL arguments produce a CLI error and non-zero exit
- Unsupported browsers produce a CLI error and non-zero exit
- Chrome profile access or decryption failures produce a clear error and non-zero exit
- If no cookies are returned for the requested site, fail fast with a clear message

## Operational Notes

- The targeted Chrome profile does not need to be open
- Closed Chrome is preferred because cookie persistence can lag while Chrome is running
- Profile selection is by Chrome profile name, for example `Default` or `Profile 2`

## Testing

- Add CLI parsing tests for `import-cookies` and runtime flags
- Add adapter tests with the Chrome library mocked behind the adapter boundary
- Add file-output tests for `import-cookies`
- Add tests that confirm browser-cookie access never happens unless explicitly requested
- Keep existing cookie JSON loading tests green
