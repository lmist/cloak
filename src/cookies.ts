import fs from "node:fs";
import path from "node:path";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export async function loadCookies(cookiesDir: string): Promise<Cookie[]> {
  if (!fs.existsSync(cookiesDir)) {
    console.log("No cookies/ directory found");
    return [];
  }

  const files = fs
    .readdirSync(cookiesDir)
    .filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No .json files in cookies/");
    return [];
  }

  const all: Cookie[] = [];

  for (const file of files) {
    const filePath = path.join(cookiesDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const cookies: Cookie[] = JSON.parse(raw);
    all.push(...cookies);
    console.log(`Loaded ${cookies.length} cookies from ${file}`);
  }

  return all;
}
