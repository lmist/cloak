# Repository Guidelines

## Project Structure & Module Organization

Source lives in [`src/`](/Users/lou/conductor/workspaces/mindv/vilnius/src). Runtime entrypoints are [`src/main.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/main.ts), [`src/cli.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/cli.ts), [`src/import-cookies.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/import-cookies.ts), and [`src/chrome-cookies.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/chrome-cookies.ts). Cookie helpers live in [`src/cookies.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/cookies.ts); extension loading lives in [`src/extension.ts`](/Users/lou/conductor/workspaces/mindv/vilnius/src/extension.ts). Tests sit beside the modules as `src/*.test.ts`. Design notes and implementation plans are stored under [`docs/superpowers/`](/Users/lou/conductor/workspaces/mindv/vilnius/docs/superpowers).

## Build, Test, and Development Commands

- `bun install`: install dependencies, create `bun.lock`, and fetch the required extension archive into `extensions/`.
- `bun test`: run the `node:test` suite directly from `src/*.test.ts` under Bun.
- `bun run typecheck`: run `tsc --noEmit`.
- `bun run build`: compile the standalone `dist/hedlis` Bun executable.
- `bun run src/main.ts --help`: run the CLI from source during development.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation and semicolons omitted, matching the existing files. Prefer small, single-purpose modules and keep browser-cookie logic isolated from CLI parsing and startup orchestration. Use `camelCase` for functions/variables, `PascalCase` only for types, and name tests after observable behavior, e.g. `main preserves the chromium launch contract for headless startup`.

No formatter or linter is configured here, so preserve the repository’s current style manually.

## Testing Guidelines

Use the built-in `node:test` runner with `assert/strict`, executed via `bun test`. Add tests in `src/<module>.test.ts`. Prefer dependency injection over real browser/profile access so tests stay hermetic. When changing startup or cookie behavior, cover both the helper-level logic and the top-level `main()` routing if behavior crosses module boundaries.

## Commit & Pull Request Guidelines

Keep commit messages short, imperative, and specific, following the current history: `Add explicit Chrome cookie import command`, `Warn about Chrome cookie collapse limitation`. Group one logical change per commit when practical.

For pull requests, include:
- a short summary of user-visible behavior changes
- test/build evidence (`bun test`, `bun run typecheck`, `bun run build`)
- any Chrome-cookie limitations or caveats that remain

## Security & Configuration Tips

Browser-cookie access is explicit and Chrome-only. Treat imported/runtime cookies as sensitive data. Do not broaden URL handling beyond HTTP(S) without revisiting the Chrome cookie reader and its failure modes. `hedlis` cannot run without `extensions/opencli-extension.zip`; preserve the pinned download URL and runtime validation/repair behavior unless the product requirement changes.
