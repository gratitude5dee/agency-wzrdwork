"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUuidLike = isUuidLike;
exports.normalizeAgentUrlKey = normalizeAgentUrlKey;
exports.deriveAgentUrlKey = deriveAgentUrlKey;
var AGENT_URL_KEY_DELIM_RE = /[^a-z0-9]+/g;
var AGENT_URL_KEY_TRIM_RE = /^-+|-+$/g;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuidLike(value) {
    if (typeof value !== "string")
        return false;
    return UUID_RE.test(value.trim());
}
function normalizeAgentUrlKey(value) {
    if (typeof value !== "string")
        return null;
    var normalized = value
        .trim()
        .toLowerCase()
        .replace(AGENT_URL_KEY_DELIM_RE, "-")
        .replace(AGENT_URL_KEY_TRIM_RE, "");
    return normalized.length > 0 ? normalized : null;
}
function deriveAgentUrlKey(name, fallback) {
    var _a, _b;
    return (_b = (_a = normalizeAgentUrlKey(name)) !== null && _a !== void 0 ? _a : normalizeAgentUrlKey(fallback)) !== null && _b !== void 0 ? _b : "agent";
}
