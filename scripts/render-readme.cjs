#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "README.org");
const targetPath = path.join(rootDir, "README.md");
const generatedBanner =
  "<!-- Generated from README.org by scripts/render-readme.cjs. Do not edit README.md directly. -->";

function renderReadme() {
  const rendered = execFileSync(
    "pandoc",
    ["-f", "org", "-t", "gfm", "--wrap=none", sourcePath],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }
  );

  const lines = rendered.split(/\r?\n/);
  if (
    lines[0] ===
    '<span class="spurious-link" target="docs/assets/cloak-logo-readme-centered.png">*docs/assets/cloak-logo-readme-centered.png*</span>'
  ) {
    lines[0] = "![cloak logo](docs/assets/cloak-logo-readme-centered.png)";
  }

  return `${generatedBanner}\n\n${lines.join("\n").trimEnd()}\n`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const content = renderReadme();
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";

  if (checkOnly) {
    if (current !== content) {
      console.error("README.md is out of date. Run `node scripts/render-readme.cjs`.");
      process.exit(1);
    }

    return;
  }

  if (current !== content) {
    fs.writeFileSync(targetPath, content);
  }
}

main();
