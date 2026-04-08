#!/usr/bin/env node
import { bootstrapInstall } from "./install-bootstrap.js";
import { formatError, formatSuccess } from "./output.js";

async function run() {
  const result = await bootstrapInstall();

  if (!result.consented || !result.archivePath) {
    return;
  }

  console.log(formatSuccess(`Required extension ready at ${result.archivePath}`));
}

run().catch((error) => {
  console.error(formatError(String(error)));
  process.exit(1);
});
