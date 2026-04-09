#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const gitDir = path.join(rootDir, ".git");

if (!fs.existsSync(gitDir)) {
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: rootDir,
    stdio: "ignore",
  });
} catch {
  process.exit(0);
}
