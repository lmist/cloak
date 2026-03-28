#!/usr/bin/env bun
import { installRequiredExtension } from "./extension.js";

async function run() {
  const archivePath = await installRequiredExtension();
  console.log(`Required extension ready at ${archivePath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
