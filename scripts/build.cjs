#!/usr/bin/env node

const { rmSync } = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const tscEntrypoint = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");

rmSync(distDir, { recursive: true, force: true });
execFileSync(process.execPath, [tscEntrypoint, "--project", "tsconfig.build.json"], {
  cwd: rootDir,
  stdio: "inherit",
});
