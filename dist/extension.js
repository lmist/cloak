"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareExtensions = prepareExtensions;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
async function prepareExtensions(extensionsDir) {
    if (!node_fs_1.default.existsSync(extensionsDir)) {
        console.log("No extensions/ directory found");
        return [];
    }
    const zips = node_fs_1.default
        .readdirSync(extensionsDir)
        .filter((f) => f.endsWith(".zip"));
    if (zips.length === 0) {
        console.log("No .zip files in extensions/");
        return [];
    }
    const paths = [];
    for (const zip of zips) {
        const zipPath = node_path_1.default.join(extensionsDir, zip);
        const tmpDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "vilnius-ext-"));
        (0, node_child_process_1.execSync)(`unzip -o -q "${zipPath}" -d "${tmpDir}"`);
        // Check if manifest.json is at root or one level deep
        if (node_fs_1.default.existsSync(node_path_1.default.join(tmpDir, "manifest.json"))) {
            paths.push(tmpDir);
        }
        else {
            const entries = node_fs_1.default
                .readdirSync(tmpDir, { withFileTypes: true })
                .filter((e) => e.isDirectory());
            const nested = entries.find((e) => node_fs_1.default.existsSync(node_path_1.default.join(tmpDir, e.name, "manifest.json")));
            if (nested) {
                paths.push(node_path_1.default.join(tmpDir, nested.name));
            }
            else {
                console.warn(`No manifest.json found in ${zip}, skipping`);
                continue;
            }
        }
        console.log(`Prepared extension: ${zip}`);
    }
    return paths;
}
