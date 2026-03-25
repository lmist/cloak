import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

export async function prepareExtensions(
  extensionsDir: string
): Promise<string[]> {
  if (!fs.existsSync(extensionsDir)) {
    console.log("No extensions/ directory found");
    return [];
  }

  const zips = fs
    .readdirSync(extensionsDir)
    .filter((f) => f.endsWith(".zip"));

  if (zips.length === 0) {
    console.log("No .zip files in extensions/");
    return [];
  }

  const paths: string[] = [];

  for (const zip of zips) {
    const zipPath = path.join(extensionsDir, zip);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vilnius-ext-"));

    execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`);

    // Check if manifest.json is at root or one level deep
    if (fs.existsSync(path.join(tmpDir, "manifest.json"))) {
      paths.push(tmpDir);
    } else {
      const entries = fs
        .readdirSync(tmpDir, { withFileTypes: true })
        .filter((e) => e.isDirectory());
      const nested = entries.find((e) =>
        fs.existsSync(path.join(tmpDir, e.name, "manifest.json"))
      );
      if (nested) {
        paths.push(path.join(tmpDir, nested.name));
      } else {
        console.warn(`No manifest.json found in ${zip}, skipping`);
        continue;
      }
    }

    console.log(`Prepared extension: ${zip}`);
  }

  return paths;
}
