"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCookiesCommand = importCookiesCommand;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const chrome_cookies_js_1 = require("./chrome-cookies.js");
async function importCookiesCommand(options, dependencies = {}) {
    const readCookies = dependencies.readChromeCookies ?? chrome_cookies_js_1.readChromeCookies;
    const warn = dependencies.warn ?? console.warn;
    const cookies = await readCookies({
        url: options.url,
        profile: options.profile,
    });
    if (cookies.length === 0) {
        throw new Error(`No cookies found for ${options.url}`);
    }
    warn(chrome_cookies_js_1.CHROME_COOKIE_LIMITATION_WARNING);
    const outputRoot = options.outputRoot ?? process.cwd();
    const outputPath = options.output
        ? node_path_1.default.resolve(outputRoot, options.output)
        : (0, chrome_cookies_js_1.defaultCookieOutputPath)(options.url, node_path_1.default.join(outputRoot, "cookies"));
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(outputPath), { recursive: true });
    node_fs_1.default.writeFileSync(outputPath, JSON.stringify(cookies, null, 2));
    return {
        count: cookies.length,
        outputPath,
    };
}
