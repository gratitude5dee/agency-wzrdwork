"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_MENTION_SCHEME = void 0;
exports.buildProjectMentionHref = buildProjectMentionHref;
exports.parseProjectMentionHref = parseProjectMentionHref;
exports.extractProjectMentionIds = extractProjectMentionIds;
exports.PROJECT_MENTION_SCHEME = "project://";
var HEX_COLOR_RE = /^[0-9a-f]{6}$/i;
var HEX_COLOR_SHORT_RE = /^[0-9a-f]{3}$/i;
var HEX_COLOR_WITH_HASH_RE = /^#[0-9a-f]{6}$/i;
var HEX_COLOR_SHORT_WITH_HASH_RE = /^#[0-9a-f]{3}$/i;
var PROJECT_MENTION_LINK_RE = /\[[^\]]*]\((project:\/\/[^)\s]+)\)/gi;
function normalizeHexColor(input) {
    if (!input)
        return null;
    var trimmed = input.trim();
    if (!trimmed)
        return null;
    if (HEX_COLOR_WITH_HASH_RE.test(trimmed)) {
        return trimmed.toLowerCase();
    }
    if (HEX_COLOR_RE.test(trimmed)) {
        return "#".concat(trimmed.toLowerCase());
    }
    if (HEX_COLOR_SHORT_WITH_HASH_RE.test(trimmed)) {
        var raw = trimmed.slice(1).toLowerCase();
        return "#".concat(raw[0]).concat(raw[0]).concat(raw[1]).concat(raw[1]).concat(raw[2]).concat(raw[2]);
    }
    if (HEX_COLOR_SHORT_RE.test(trimmed)) {
        var raw = trimmed.toLowerCase();
        return "#".concat(raw[0]).concat(raw[0]).concat(raw[1]).concat(raw[1]).concat(raw[2]).concat(raw[2]);
    }
    return null;
}
function buildProjectMentionHref(projectId, color) {
    var trimmedProjectId = projectId.trim();
    var normalizedColor = normalizeHexColor(color !== null && color !== void 0 ? color : null);
    if (!normalizedColor) {
        return "".concat(exports.PROJECT_MENTION_SCHEME).concat(trimmedProjectId);
    }
    return "".concat(exports.PROJECT_MENTION_SCHEME).concat(trimmedProjectId, "?c=").concat(encodeURIComponent(normalizedColor.slice(1)));
}
function parseProjectMentionHref(href) {
    var _a;
    if (!href.startsWith(exports.PROJECT_MENTION_SCHEME))
        return null;
    var url;
    try {
        url = new URL(href);
    }
    catch (_b) {
        return null;
    }
    if (url.protocol !== "project:")
        return null;
    var projectId = "".concat(url.hostname).concat(url.pathname).replace(/^\/+/, "").trim();
    if (!projectId)
        return null;
    var color = normalizeHexColor((_a = url.searchParams.get("c")) !== null && _a !== void 0 ? _a : url.searchParams.get("color"));
    return {
        projectId: projectId,
        color: color,
    };
}
function extractProjectMentionIds(markdown) {
    if (!markdown)
        return [];
    var ids = new Set();
    var re = new RegExp(PROJECT_MENTION_LINK_RE);
    var match;
    while ((match = re.exec(markdown)) !== null) {
        var parsed = parseProjectMentionHref(match[1]);
        if (parsed)
            ids.add(parsed.projectId);
    }
    return __spreadArray([], ids, true);
}
