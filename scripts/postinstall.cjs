#!/usr/bin/env node

const { existsSync } = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const distEntrypoint = path.join(rootDir, "dist", "install-extension.js");
const sourceEntrypoint = path.join(rootDir, "src", "install-extension.ts");
const tsxEntrypoint = path.join(rootDir, "node_modules", "tsx", "dist", "loader.mjs");

const command = process.execPath;
const args = existsSync(sourceEntrypoint) && existsSync(tsxEntrypoint)
  ? ["--import", "tsx", sourceEntrypoint]
  : [distEntrypoint];

execFileSync(command, args, {
  cwd: rootDir,
  stdio: "inherit",
});
