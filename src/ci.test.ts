import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readCiWorkflow() {
  return fs.readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("ci workflow runs on pull requests and pushes to main", () => {
  const workflow = readCiWorkflow();

  assert.match(workflow, /^on:/m);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/m);
});

test("ci workflow uses Node and npm for install, test, typecheck, and build", () => {
  const workflow = readCiWorkflow();

  assert.match(workflow, /uses:\s+actions\/setup-node@v5/);
  assert.match(workflow, /node-version:\s+24/);
  assert.match(workflow, /cache:\s+npm/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
});

test("ci workflow uses a Node 24-compatible checkout action", () => {
  const workflow = readCiWorkflow();

  assert.match(workflow, /uses:\s+actions\/checkout@v[56]/);
});

test("ci workflow cancels superseded runs and keeps read-only permissions", () => {
  const workflow = readCiWorkflow();

  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/m);
});
