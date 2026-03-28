import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readCiWorkflow() {
  return fs.readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
}

test("ci workflow runs on pull requests and pushes to main", () => {
  const workflow = readCiWorkflow();

  assert.match(workflow, /^on:/m);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/m);
});

test("ci workflow uses bun for install, test, typecheck, and build", () => {
  const workflow = readCiWorkflow();

  assert.match(workflow, /uses:\s+oven-sh\/setup-bun@/);
  assert.match(workflow, /bun install --frozen-lockfile/);
  assert.match(workflow, /bun test/);
  assert.match(workflow, /bun run typecheck/);
  assert.match(workflow, /bun run build/);
});

test("ci workflow cancels superseded runs and keeps read-only permissions", () => {
  const workflow = readCiWorkflow();

  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/m);
});
