"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function readCiWorkflow() {
    return node_fs_1.default.readFileSync(node_path_1.default.resolve(".github/workflows/ci.yml"), "utf8");
}
(0, node_test_1.default)("ci workflow runs on pull requests and pushes to main", () => {
    const workflow = readCiWorkflow();
    strict_1.default.match(workflow, /^on:/m);
    strict_1.default.match(workflow, /pull_request:/);
    strict_1.default.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/m);
});
(0, node_test_1.default)("ci workflow uses the current node lts line for test and build", () => {
    const workflow = readCiWorkflow();
    strict_1.default.match(workflow, /node-version:\s+lts\/\*/);
    strict_1.default.match(workflow, /npm ci/);
    strict_1.default.match(workflow, /npm test/);
    strict_1.default.match(workflow, /npm run build/);
});
(0, node_test_1.default)("ci workflow cancels superseded runs and keeps read-only permissions", () => {
    const workflow = readCiWorkflow();
    strict_1.default.match(workflow, /concurrency:/);
    strict_1.default.match(workflow, /cancel-in-progress:\s+true/);
    strict_1.default.match(workflow, /permissions:\s*\n\s+contents:\s+read/m);
});
