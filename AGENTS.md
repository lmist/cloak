# Repository Guidelines

## Project Structure & Module Organization

Source lives in [`src/`](/Users/lou/conductor/workspaces/mindv/vilnius/src). Runtime entrypoints are [`src/main.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/main.ts), [`src/cli.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/cli.ts), [`src/import-cookies.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/import-cookies.ts), and [`src/chrome-cookies.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/chrome-cookies.ts). Cookie helpers live in [`src/cookies.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/cookies.ts); extension loading lives in [`src/extension.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/extension.ts). Tests sit beside the modules as `src/*.test.ts`. Design notes and implementation plans are stored under [`docs/superpowers/`](/Users/lou/conductor/workspaces/mindv/vilnius/docs/superpowers).

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run build`: compile TypeScript to `dist/`.
- `npm test`: compile and run the full `node:test` suite from `dist/*.test.js`.
- `npm start -- --headless`: build, then launch the CLI locally.
- `node dist/main.js import-cookies --browser chrome --url https://example.com`: run the compiled CLI directly after building.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation and semicolons omitted, matching the existing files. Prefer small, single-purpose modules and keep browser-cookie logic isolated from CLI parsing and startup orchestration. Use `camelCase` for functions/variables, `PascalCase` only for types, and name tests after observable behavior, e.g. `main preserves the chromium launch contract for headless startup`.

No formatter or linter is configured here, so preserve the repository’s current style manually.

## Testing Guidelines

Use the built-in `node:test` runner with `assert/strict`. Add tests in `src/<module>.test.ts`. Prefer dependency injection over real browser/profile access so tests stay hermetic. When changing startup or cookie behavior, cover both the helper-level logic and the top-level `main()` routing if behavior crosses module boundaries.

## Commit & Pull Request Guidelines

Keep commit messages short, imperative, and specific, following the current history: `Add explicit Chrome cookie import command`, `Warn about Chrome cookie collapse limitation`. Group one logical change per commit when practical.

For pull requests, include:
- a short summary of user-visible behavior changes
- test/build evidence (`npm test`, `npm run build`)
- any Chrome-cookie limitations or caveats that remain

## Security & Configuration Tips

Browser-cookie access is explicit and Chrome-only. Treat imported/runtime cookies as sensitive data. Do not broaden URL handling beyond HTTP(S) without revisiting the Chrome cookie reader and its failure modes.
