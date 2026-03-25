import { chromium } from "playwright";
import path from "node:path";
import { prepareExtensions } from "./extension.js";
import { loadCookies } from "./cookies.js";

async function main() {
  const extensionsDir = path.resolve("extensions");
  const cookiesDir = path.resolve("cookies");

  // Prepare extensions from zips
  const extensionPaths = await prepareExtensions(extensionsDir);

  // Build chromium args
  const args: string[] = [];
  if (extensionPaths.length > 0) {
    const joined = extensionPaths.join(",");
    args.push(`--disable-extensions-except=${joined}`);
    args.push(`--load-extension=${joined}`);
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args,
  });

  const context = await browser.newContext();

  // Inject cookies
  const cookies = await loadCookies(cookiesDir);
  if (cookies.length > 0) {
    await context.addCookies(cookies);
    console.log(`Injected ${cookies.length} cookies`);
  }

  // Open a page so the window is visible
  await context.newPage();
  console.log("Browser running. Ctrl+C to exit.");

  // Keep alive until browser closes or process is killed
  await new Promise<void>((resolve) => {
    browser.on("disconnected", () => resolve());
    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      resolve();
    });
    process.on("SIGTERM", () => {
      console.log("\nShutting down...");
      resolve();
    });
  });

  await browser.close().catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
