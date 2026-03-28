"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeProjectUrlKey = normalizeProjectUrlKey;
exports.deriveProjectUrlKey = deriveProjectUrlKey;
var PROJECT_URL_KEY_DELIM_RE = /[^a-z0-9]+/g;
var PROJECT_URL_KEY_TRIM_RE = /^-+|-+$/g;
function normalizeProjectUrlKey(value) {
    if (typeof value !== "string")
        return null;
    var normalized = value
        .trim()
        .toLowerCase()
        .replace(PROJECT_URL_KEY_DELIM_RE, "-")
        .replace(PROJECT_URL_KEY_TRIM_RE, "");
    return normalized.length > 0 ? normalized : null;
}
function deriveProjectUrlKey(name, fallback) {
    var _a, _b;
    return (_b = (_a = normalizeProjectUrlKey(name)) !== null && _a !== void 0 ? _a : normalizeProjectUrlKey(fallback)) !== null && _b !== void 0 ? _b : "project";
}
