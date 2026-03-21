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
exports.listPluginStateSchema = exports.setPluginStateSchema = exports.pluginStateScopeKeySchema = exports.uninstallPluginSchema = exports.updatePluginStatusSchema = exports.patchPluginConfigSchema = exports.upsertPluginConfigSchema = exports.installPluginSchema = exports.pluginManifestV1Schema = exports.pluginLauncherDeclarationSchema = exports.pluginLauncherRenderDeclarationSchema = exports.pluginLauncherActionDeclarationSchema = exports.pluginUiSlotDeclarationSchema = exports.pluginToolDeclarationSchema = exports.pluginWebhookDeclarationSchema = exports.pluginJobDeclarationSchema = exports.jsonSchemaSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
// ---------------------------------------------------------------------------
// JSON Schema placeholder – a permissive validator for JSON Schema objects
// ---------------------------------------------------------------------------
/**
 * Permissive validator for JSON Schema objects. Accepts any `Record<string, unknown>`
 * that contains at least a `type`, `$ref`, or composition keyword (`oneOf`/`anyOf`/`allOf`).
 * Empty objects are also accepted.
 *
 * Used to validate `instanceConfigSchema` and `parametersSchema` fields in the
 * plugin manifest without fully parsing JSON Schema.
 *
 * @see PLUGIN_SPEC.md §10.1 — Manifest shape
 */
exports.jsonSchemaSchema = zod_1.z.record(zod_1.z.unknown()).refine(function (val) {
    // Must have a "type" field if non-empty, or be a valid JSON Schema object
    if (Object.keys(val).length === 0)
        return true;
    return typeof val.type === "string" || val.$ref !== undefined || val.oneOf !== undefined || val.anyOf !== undefined || val.allOf !== undefined;
}, { message: "Must be a valid JSON Schema object (requires at least a 'type', '$ref', or composition keyword)" });
// ---------------------------------------------------------------------------
// Manifest sub-type schemas
// ---------------------------------------------------------------------------
/**
 * Validates a {@link PluginJobDeclaration} — a scheduled job declared in the
 * plugin manifest. Requires `jobKey` and `displayName`; `description` and
 * `schedule` (cron expression) are optional.
 *
 * @see PLUGIN_SPEC.md §17 — Scheduled Jobs
 */
/**
 * Validates a cron expression has exactly 5 whitespace-separated fields,
 * each containing only valid cron characters (digits, *, /, -, ,).
 *
 * Valid tokens per field: *, N, N-M, N/S, * /S, N-M/S, and comma-separated lists.
 */
var CRON_FIELD_PATTERN = /^(\*(?:\/[0-9]+)?|[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?)(?:,(\*(?:\/[0-9]+)?|[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?))*$/;
function isValidCronExpression(expression) {
    var trimmed = expression.trim();
    if (!trimmed)
        return false;
    var fields = trimmed.split(/\s+/);
    if (fields.length !== 5)
        return false;
    return fields.every(function (f) { return CRON_FIELD_PATTERN.test(f); });
}
exports.pluginJobDeclarationSchema = zod_1.z.object({
    jobKey: zod_1.z.string().min(1),
    displayName: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    schedule: zod_1.z.string().refine(function (val) { return isValidCronExpression(val); }, { message: "schedule must be a valid 5-field cron expression (e.g. '*/15 * * * *')" }).optional(),
});
/**
 * Validates a {@link PluginWebhookDeclaration} — a webhook endpoint declared
 * in the plugin manifest. Requires `endpointKey` and `displayName`.
 *
 * @see PLUGIN_SPEC.md §18 — Webhooks
 */
exports.pluginWebhookDeclarationSchema = zod_1.z.object({
    endpointKey: zod_1.z.string().min(1),
    displayName: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
});
/**
 * Validates a {@link PluginToolDeclaration} — an agent tool contributed by the
 * plugin. Requires `name`, `displayName`, `description`, and a valid
 * `parametersSchema`. Requires the `agent.tools.register` capability.
 *
 * @see PLUGIN_SPEC.md §11 — Agent Tools
 */
exports.pluginToolDeclarationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    displayName: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    parametersSchema: exports.jsonSchemaSchema,
});
/**
 * Validates a {@link PluginUiSlotDeclaration} — a UI extension slot the plugin
 * fills with a React component. Includes `superRefine` checks for slot-specific
 * requirements such as `entityTypes` for context-sensitive slots.
 *
 * @see PLUGIN_SPEC.md §19 — UI Extension Model
 */
exports.pluginUiSlotDeclarationSchema = zod_1.z.object({
    type: zod_1.z.enum(constants_js_1.PLUGIN_UI_SLOT_TYPES),
    id: zod_1.z.string().min(1),
    displayName: zod_1.z.string().min(1),
    exportName: zod_1.z.string().min(1),
    entityTypes: zod_1.z.array(zod_1.z.enum(constants_js_1.PLUGIN_UI_SLOT_ENTITY_TYPES)).optional(),
    routePath: zod_1.z.string().regex(/^[a-z0-9][a-z0-9-]*$/, {
        message: "routePath must be a lowercase single-segment slug (letters, numbers, hyphens)",
    }).optional(),
    order: zod_1.z.number().int().optional(),
}).superRefine(function (value, ctx) {
    // context-sensitive slots require explicit entity targeting.
    var entityScopedTypes = ["detailTab", "taskDetailView", "contextMenuItem", "commentAnnotation", "commentContextMenuItem", "projectSidebarItem"];
    if (entityScopedTypes.includes(value.type)
        && (!value.entityTypes || value.entityTypes.length === 0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "".concat(value.type, " slots require at least one entityType"),
            path: ["entityTypes"],
        });
    }
    // projectSidebarItem only makes sense for entityType "project".
    if (value.type === "projectSidebarItem" && value.entityTypes && !value.entityTypes.includes("project")) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "projectSidebarItem slots require entityTypes to include \"project\"",
            path: ["entityTypes"],
        });
    }
    // commentAnnotation only makes sense for entityType "comment".
    if (value.type === "commentAnnotation" && value.entityTypes && !value.entityTypes.includes("comment")) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "commentAnnotation slots require entityTypes to include \"comment\"",
            path: ["entityTypes"],
        });
    }
    // commentContextMenuItem only makes sense for entityType "comment".
    if (value.type === "commentContextMenuItem" && value.entityTypes && !value.entityTypes.includes("comment")) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "commentContextMenuItem slots require entityTypes to include \"comment\"",
            path: ["entityTypes"],
        });
    }
    if (value.routePath && value.type !== "page") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "routePath is only supported for page slots",
            path: ["routePath"],
        });
    }
    if (value.routePath && constants_js_1.PLUGIN_RESERVED_COMPANY_ROUTE_SEGMENTS.includes(value.routePath)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "routePath \"".concat(value.routePath, "\" is reserved by the host"),
            path: ["routePath"],
        });
    }
});
var entityScopedLauncherPlacementZones = [
    "detailTab",
    "taskDetailView",
    "contextMenuItem",
    "commentAnnotation",
    "commentContextMenuItem",
    "projectSidebarItem",
];
var launcherBoundsByEnvironment = {
    hostInline: ["inline", "compact", "default"],
    hostOverlay: ["compact", "default", "wide", "full"],
    hostRoute: ["default", "wide", "full"],
    external: [],
    iframe: ["compact", "default", "wide", "full"],
};
/**
 * Validates the action payload for a declarative plugin launcher.
 */
exports.pluginLauncherActionDeclarationSchema = zod_1.z.object({
    type: zod_1.z.enum(constants_js_1.PLUGIN_LAUNCHER_ACTIONS),
    target: zod_1.z.string().min(1),
    params: zod_1.z.record(zod_1.z.unknown()).optional(),
}).superRefine(function (value, ctx) {
    if (value.type === "performAction" && value.target.includes("/")) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "performAction launchers must target an action key, not a route or URL",
            path: ["target"],
        });
    }
    if (value.type === "navigate" && /^https?:\/\//.test(value.target)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "navigate launchers must target a host route, not an absolute URL",
            path: ["target"],
        });
    }
});
/**
 * Validates optional render hints for a plugin launcher destination.
 */
exports.pluginLauncherRenderDeclarationSchema = zod_1.z.object({
    environment: zod_1.z.enum(constants_js_1.PLUGIN_LAUNCHER_RENDER_ENVIRONMENTS),
    bounds: zod_1.z.enum(constants_js_1.PLUGIN_LAUNCHER_BOUNDS).optional(),
}).superRefine(function (value, ctx) {
    if (!value.bounds) {
        return;
    }
    var supportedBounds = launcherBoundsByEnvironment[value.environment];
    if (!supportedBounds.includes(value.bounds)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "bounds \"".concat(value.bounds, "\" is not supported for render environment \"").concat(value.environment, "\""),
            path: ["bounds"],
        });
    }
});
/**
 * Validates declarative launcher metadata in a plugin manifest.
 */
exports.pluginLauncherDeclarationSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    displayName: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    placementZone: zod_1.z.enum(constants_js_1.PLUGIN_LAUNCHER_PLACEMENT_ZONES),
    exportName: zod_1.z.string().min(1).optional(),
    entityTypes: zod_1.z.array(zod_1.z.enum(constants_js_1.PLUGIN_UI_SLOT_ENTITY_TYPES)).optional(),
    order: zod_1.z.number().int().optional(),
    action: exports.pluginLauncherActionDeclarationSchema,
    render: exports.pluginLauncherRenderDeclarationSchema.optional(),
}).superRefine(function (value, ctx) {
    var _a, _b;
    if (entityScopedLauncherPlacementZones.some(function (zone) { return zone === value.placementZone; })
        && (!value.entityTypes || value.entityTypes.length === 0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "".concat(value.placementZone, " launchers require at least one entityType"),
            path: ["entityTypes"],
        });
    }
    if (value.placementZone === "projectSidebarItem"
        && value.entityTypes
        && !value.entityTypes.includes("project")) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "projectSidebarItem launchers require entityTypes to include \"project\"",
            path: ["entityTypes"],
        });
    }
    if (value.action.type === "performAction" && value.render) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "performAction launchers cannot declare render hints",
            path: ["render"],
        });
    }
    if (["openModal", "openDrawer", "openPopover"].includes(value.action.type)
        && !value.render) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "".concat(value.action.type, " launchers require render metadata"),
            path: ["render"],
        });
    }
    if (value.action.type === "openModal" && ((_a = value.render) === null || _a === void 0 ? void 0 : _a.environment) === "hostInline") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "openModal launchers cannot use the hostInline render environment",
            path: ["render", "environment"],
        });
    }
    if (value.action.type === "openDrawer"
        && value.render
        && !["hostOverlay", "iframe"].includes(value.render.environment)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "openDrawer launchers must use hostOverlay or iframe render environments",
            path: ["render", "environment"],
        });
    }
    if (value.action.type === "openPopover" && ((_b = value.render) === null || _b === void 0 ? void 0 : _b.environment) === "hostRoute") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "openPopover launchers cannot use the hostRoute render environment",
            path: ["render", "environment"],
        });
    }
});
// ---------------------------------------------------------------------------
// Plugin Manifest V1 schema
// ---------------------------------------------------------------------------
/**
 * Zod schema for {@link PaperclipPluginManifestV1} — the complete runtime
 * validator for plugin manifests read at install time.
 *
 * Field-level constraints (see PLUGIN_SPEC.md §10.1 for the normative rules):
 *
 * | Field                    | Type       | Constraints                                  |
 * |--------------------------|------------|----------------------------------------------|
 * | `id`                     | string     | `^[a-z0-9][a-z0-9._-]*$`                    |
 * | `apiVersion`             | literal 1  | must equal `PLUGIN_API_VERSION`              |
 * | `version`                | string     | semver (`\d+\.\d+\.\d+`)                    |
 * | `displayName`            | string     | 1–100 chars                                  |
 * | `description`            | string     | 1–500 chars                                  |
 * | `author`                 | string     | 1–200 chars                                  |
 * | `categories`             | enum[]     | at least one; values from PLUGIN_CATEGORIES  |
 * | `minimumHostVersion`     | string?    | semver lower bound if present, no leading `v`|
 * | `minimumPaperclipVersion`| string?    | legacy alias of `minimumHostVersion`         |
 * | `capabilities`           | enum[]     | at least one; values from PLUGIN_CAPABILITIES|
 * | `entrypoints.worker`     | string     | min 1 char                                   |
 * | `entrypoints.ui`         | string?    | required when `ui.slots` is declared         |
 *
 * Cross-field rules enforced via `superRefine`:
 * - `entrypoints.ui` required when `ui.slots` declared
 * - `agent.tools.register` capability required when `tools` declared
 * - `jobs.schedule` capability required when `jobs` declared
 * - `webhooks.receive` capability required when `webhooks` declared
 * - duplicate `jobs[].jobKey` values are rejected
 * - duplicate `webhooks[].endpointKey` values are rejected
 * - duplicate `tools[].name` values are rejected
 * - duplicate `ui.slots[].id` values are rejected
 *
 * @see PLUGIN_SPEC.md §10.1 — Manifest shape
 * @see {@link PaperclipPluginManifestV1} — the inferred TypeScript type
 */
exports.pluginManifestV1Schema = zod_1.z.object({
    id: zod_1.z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/, "Plugin id must start with a lowercase alphanumeric and contain only lowercase letters, digits, dots, hyphens, or underscores"),
    apiVersion: zod_1.z.literal(1),
    version: zod_1.z.string().min(1).regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/, "Version must follow semver (e.g. 1.0.0 or 1.0.0-beta.1)"),
    displayName: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().min(1).max(500),
    author: zod_1.z.string().min(1).max(200),
    categories: zod_1.z.array(zod_1.z.enum(constants_js_1.PLUGIN_CATEGORIES)).min(1),
    minimumHostVersion: zod_1.z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/, "minimumHostVersion must follow semver (e.g. 1.0.0)").optional(),
    minimumPaperclipVersion: zod_1.z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/, "minimumPaperclipVersion must follow semver (e.g. 1.0.0)").optional(),
    capabilities: zod_1.z.array(zod_1.z.enum(constants_js_1.PLUGIN_CAPABILITIES)).min(1),
    entrypoints: zod_1.z.object({
        worker: zod_1.z.string().min(1),
        ui: zod_1.z.string().min(1).optional(),
    }),
    instanceConfigSchema: exports.jsonSchemaSchema.optional(),
    jobs: zod_1.z.array(exports.pluginJobDeclarationSchema).optional(),
    webhooks: zod_1.z.array(exports.pluginWebhookDeclarationSchema).optional(),
    tools: zod_1.z.array(exports.pluginToolDeclarationSchema).optional(),
    launchers: zod_1.z.array(exports.pluginLauncherDeclarationSchema).optional(),
    ui: zod_1.z.object({
        slots: zod_1.z.array(exports.pluginUiSlotDeclarationSchema).min(1).optional(),
        launchers: zod_1.z.array(exports.pluginLauncherDeclarationSchema).optional(),
    }).optional(),
}).superRefine(function (manifest, ctx) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    // ── Entrypoint ↔ UI slot consistency ──────────────────────────────────
    // Plugins that declare UI slots must also declare a UI entrypoint so the
    // host knows where to load the bundle from (PLUGIN_SPEC.md §10.1).
    var hasUiSlots = ((_c = (_b = (_a = manifest.ui) === null || _a === void 0 ? void 0 : _a.slots) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) > 0;
    var hasUiLaunchers = ((_f = (_e = (_d = manifest.ui) === null || _d === void 0 ? void 0 : _d.launchers) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0) > 0;
    if ((hasUiSlots || hasUiLaunchers) && !manifest.entrypoints.ui) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "entrypoints.ui is required when ui.slots or ui.launchers are declared",
            path: ["entrypoints", "ui"],
        });
    }
    if (manifest.minimumHostVersion
        && manifest.minimumPaperclipVersion
        && manifest.minimumHostVersion !== manifest.minimumPaperclipVersion) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "minimumHostVersion and minimumPaperclipVersion must match when both are declared",
            path: ["minimumHostVersion"],
        });
    }
    // ── Capability ↔ feature declaration consistency ───────────────────────
    // The host enforces capabilities at install and runtime. A plugin must
    // declare every capability it needs up-front; silently having more features
    // than capabilities would cause runtime rejections.
    // tools require agent.tools.register (PLUGIN_SPEC.md §11)
    if (manifest.tools && manifest.tools.length > 0) {
        if (!manifest.capabilities.includes("agent.tools.register")) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Capability 'agent.tools.register' is required when tools are declared",
                path: ["capabilities"],
            });
        }
    }
    // jobs require jobs.schedule (PLUGIN_SPEC.md §17)
    if (manifest.jobs && manifest.jobs.length > 0) {
        if (!manifest.capabilities.includes("jobs.schedule")) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Capability 'jobs.schedule' is required when jobs are declared",
                path: ["capabilities"],
            });
        }
    }
    // webhooks require webhooks.receive (PLUGIN_SPEC.md §18)
    if (manifest.webhooks && manifest.webhooks.length > 0) {
        if (!manifest.capabilities.includes("webhooks.receive")) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Capability 'webhooks.receive' is required when webhooks are declared",
                path: ["capabilities"],
            });
        }
    }
    // ── Uniqueness checks ──────────────────────────────────────────────────
    // Duplicate keys within a plugin's own manifest are always a bug. The host
    // would not know which declaration takes precedence, so we reject early.
    // job keys must be unique within the plugin (used as identifiers in the DB)
    if (manifest.jobs) {
        var jobKeys_1 = manifest.jobs.map(function (j) { return j.jobKey; });
        var duplicates = jobKeys_1.filter(function (key, i) { return jobKeys_1.indexOf(key) !== i; });
        if (duplicates.length > 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Duplicate job keys: ".concat(__spreadArray([], new Set(duplicates), true).join(", ")),
                path: ["jobs"],
            });
        }
    }
    // webhook endpoint keys must be unique within the plugin (used in routes)
    if (manifest.webhooks) {
        var endpointKeys_1 = manifest.webhooks.map(function (w) { return w.endpointKey; });
        var duplicates = endpointKeys_1.filter(function (key, i) { return endpointKeys_1.indexOf(key) !== i; });
        if (duplicates.length > 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Duplicate webhook endpoint keys: ".concat(__spreadArray([], new Set(duplicates), true).join(", ")),
                path: ["webhooks"],
            });
        }
    }
    // tool names must be unique within the plugin (namespaced at runtime)
    if (manifest.tools) {
        var toolNames_1 = manifest.tools.map(function (t) { return t.name; });
        var duplicates = toolNames_1.filter(function (name, i) { return toolNames_1.indexOf(name) !== i; });
        if (duplicates.length > 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Duplicate tool names: ".concat(__spreadArray([], new Set(duplicates), true).join(", ")),
                path: ["tools"],
            });
        }
    }
    // UI slot ids must be unique within the plugin (namespaced at runtime)
    if (manifest.ui) {
        if (manifest.ui.slots) {
            var slotIds_1 = manifest.ui.slots.map(function (s) { return s.id; });
            var duplicates = slotIds_1.filter(function (id, i) { return slotIds_1.indexOf(id) !== i; });
            if (duplicates.length > 0) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: "Duplicate UI slot ids: ".concat(__spreadArray([], new Set(duplicates), true).join(", ")),
                    path: ["ui", "slots"],
                });
            }
        }
    }
    // launcher ids must be unique within the plugin
    var allLaunchers = __spreadArray(__spreadArray([], ((_g = manifest.launchers) !== null && _g !== void 0 ? _g : []), true), ((_j = (_h = manifest.ui) === null || _h === void 0 ? void 0 : _h.launchers) !== null && _j !== void 0 ? _j : []), true);
    if (allLaunchers.length > 0) {
        var launcherIds_1 = allLaunchers.map(function (launcher) { return launcher.id; });
        var duplicates = launcherIds_1.filter(function (id, i) { return launcherIds_1.indexOf(id) !== i; });
        if (duplicates.length > 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Duplicate launcher ids: ".concat(__spreadArray([], new Set(duplicates), true).join(", ")),
                path: ((_k = manifest.ui) === null || _k === void 0 ? void 0 : _k.launchers) ? ["ui", "launchers"] : ["launchers"],
            });
        }
    }
});
// ---------------------------------------------------------------------------
// Plugin installation / registration request
// ---------------------------------------------------------------------------
/**
 * Schema for installing (registering) a plugin.
 * The server receives the packageName and resolves the manifest from the
 * installed package.
 */
exports.installPluginSchema = zod_1.z.object({
    packageName: zod_1.z.string().min(1),
    version: zod_1.z.string().min(1).optional(),
    /** Set by loader for local-path installs so the worker can be resolved. */
    packagePath: zod_1.z.string().min(1).optional(),
});
// ---------------------------------------------------------------------------
// Plugin config (instance configuration) schemas
// ---------------------------------------------------------------------------
/**
 * Schema for creating or updating a plugin's instance configuration.
 * configJson is validated permissively here; runtime validation against
 * the plugin's instanceConfigSchema is done at the service layer.
 */
exports.upsertPluginConfigSchema = zod_1.z.object({
    configJson: zod_1.z.record(zod_1.z.unknown()),
});
/**
 * Schema for partially updating a plugin's instance configuration.
 * Allows a partial merge of config values.
 */
exports.patchPluginConfigSchema = zod_1.z.object({
    configJson: zod_1.z.record(zod_1.z.unknown()),
});
// ---------------------------------------------------------------------------
// Plugin status update
// ---------------------------------------------------------------------------
/**
 * Schema for updating a plugin's lifecycle status. Used by the lifecycle
 * manager to persist state transitions.
 *
 * @see {@link PLUGIN_STATUSES} for the valid status values
 */
exports.updatePluginStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(constants_js_1.PLUGIN_STATUSES),
    lastError: zod_1.z.string().nullable().optional(),
});
// ---------------------------------------------------------------------------
// Plugin uninstall
// ---------------------------------------------------------------------------
/** Schema for the uninstall request. `removeData` controls hard vs soft delete. */
exports.uninstallPluginSchema = zod_1.z.object({
    removeData: zod_1.z.boolean().optional().default(false),
});
// ---------------------------------------------------------------------------
// Plugin state (key-value storage) schemas
// ---------------------------------------------------------------------------
/**
 * Schema for a plugin state scope key — identifies the exact location where
 * state is stored. Used by the `ctx.state.get()`, `ctx.state.set()`, and
 * `ctx.state.delete()` SDK methods.
 *
 * @see PLUGIN_SPEC.md §21.3 `plugin_state`
 */
exports.pluginStateScopeKeySchema = zod_1.z.object({
    scopeKind: zod_1.z.enum(constants_js_1.PLUGIN_STATE_SCOPE_KINDS),
    scopeId: zod_1.z.string().min(1).optional(),
    namespace: zod_1.z.string().min(1).optional(),
    stateKey: zod_1.z.string().min(1),
});
/**
 * Schema for setting a plugin state value.
 */
exports.setPluginStateSchema = zod_1.z.object({
    scopeKind: zod_1.z.enum(constants_js_1.PLUGIN_STATE_SCOPE_KINDS),
    scopeId: zod_1.z.string().min(1).optional(),
    namespace: zod_1.z.string().min(1).optional(),
    stateKey: zod_1.z.string().min(1),
    /** JSON-serializable value to store. */
    value: zod_1.z.unknown(),
});
/**
 * Schema for querying plugin state entries. All fields are optional to allow
 * flexible list queries (e.g. all state for a plugin within a scope).
 */
exports.listPluginStateSchema = zod_1.z.object({
    scopeKind: zod_1.z.enum(constants_js_1.PLUGIN_STATE_SCOPE_KINDS).optional(),
    scopeId: zod_1.z.string().min(1).optional(),
    namespace: zod_1.z.string().min(1).optional(),
});
