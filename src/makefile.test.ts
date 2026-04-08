import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readMakefile() {
  return fs.readFileSync(path.resolve("Makefile"), "utf8");
}

test("Makefile exposes the npm development workflow", () => {
  const makefile = readMakefile();

  assert.match(makefile, /^\.DEFAULT_GOAL := help/m);
  assert.match(makefile, /^install:/m);
  assert.match(makefile, /^\tnpm install$/m);
  assert.match(makefile, /^browser:/m);
  assert.match(makefile, /^\tnpx patchright install chromium$/m);
  assert.match(makefile, /^test:/m);
  assert.match(makefile, /^\tnpm test$/m);
  assert.match(makefile, /^typecheck:/m);
  assert.match(makefile, /^\tnpm run typecheck$/m);
  assert.match(makefile, /^build:/m);
  assert.match(makefile, /^\tnpm run build$/m);
  assert.match(makefile, /^cli-help:/m);
  assert.match(makefile, /^\tnode --import tsx src\/main\.ts --help$/m);
  assert.match(makefile, /^binary-help:/m);
  assert.match(makefile, /^\tnode dist\/main\.js --help$/m);
  assert.match(makefile, /^clean:/m);
  assert.match(makefile, /^\trm -rf dist$/m);
});
