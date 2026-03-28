"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
(0, node_test_1.default)("package metadata exposes the hedlis binary", () => {
    const packageJson = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.resolve("package.json"), "utf8"));
    strict_1.default.equal(packageJson.name, "hedlis");
    strict_1.default.deepEqual(packageJson.bin, {
        hedlis: "dist/main.js",
    });
    strict_1.default.deepEqual(packageJson.files, ["dist", "README.md", "usage.md"]);
    strict_1.default.equal(packageJson.scripts?.prepare, undefined);
    strict_1.default.equal(packageJson.scripts?.build, "tsc && chmod +x dist/main.js");
    strict_1.default.ok(packageJson.dependencies?.patchright);
});
(0, node_test_1.default)("compiled main entrypoint is executable as a node script", () => {
    const mainScript = node_fs_1.default.readFileSync(node_path_1.default.resolve("dist/main.js"), "utf8");
    const mainScriptMode = node_fs_1.default.statSync(node_path_1.default.resolve("dist/main.js")).mode & 0o777;
    strict_1.default.match(mainScript, /^#!\/usr\/bin\/env node/m);
    strict_1.default.equal(mainScriptMode & 0o111, 0o111);
});
(0, node_test_1.default)("package tarball includes the compiled hedlis entrypoint", () => {
    const packOutput = (0, node_child_process_1.execFileSync)("npm", ["pack", "--dry-run", "--json"], {
        encoding: "utf8",
    });
    const packResult = JSON.parse(packOutput);
    strict_1.default.ok(packResult[0]?.files?.some((file) => file.path === "dist/main.js"), "expected npm pack output to include dist/main.js");
});
(0, node_test_1.default)("compiled hedlis entrypoint is tracked in git for GitHub installs", () => {
    const trackedPath = (0, node_child_process_1.execFileSync)("git", ["ls-files", "--error-unmatch", "dist/main.js"], { encoding: "utf8" }).trim();
    strict_1.default.equal(trackedPath, "dist/main.js");
});
(0, node_test_1.default)("readme documents engine configuration and patchright setup", () => {
    const readme = node_fs_1.default.readFileSync(node_path_1.default.resolve("README.md"), "utf8");
    strict_1.default.match(readme, /hedlis config set engine patchright/);
    strict_1.default.match(readme, /hedlis config get engine/);
    strict_1.default.match(readme, /npx patchright install chromium/);
});
