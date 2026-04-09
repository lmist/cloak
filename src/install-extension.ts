#!/usr/bin/env node
import { installRequiredExtension } from "./extension.js";
import { formatError, formatSuccess } from "./output.js";

async function run() {
  const archivePath = await installRequiredExtension();
  console.log(formatSuccess(`Required extension ready at ${archivePath}`));
}

run().catch((error) => {
  console.error(formatError(String(error)));
  process.exit(1);
});
