"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAgentPermissionsSchema = exports.testAdapterEnvironmentSchema = exports.resetAgentSessionSchema = exports.wakeAgentSchema = exports.createAgentKeySchema = exports.updateAgentInstructionsPathSchema = exports.updateAgentSchema = exports.createAgentHireSchema = exports.createAgentSchema = exports.agentPermissionsSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
var secret_js_1 = require("./secret.js");
exports.agentPermissionsSchema = zod_1.z.object({
    canCreateAgents: zod_1.z.boolean().optional().default(false),
});
var adapterConfigSchema = zod_1.z.record(zod_1.z.unknown()).superRefine(function (value, ctx) {
    var envValue = value.env;
    if (envValue === undefined)
        return;
    var parsed = secret_js_1.envConfigSchema.safeParse(envValue);
    if (!parsed.success) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "adapterConfig.env must be a map of valid env bindings",
            path: ["env"],
        });
    }
});
exports.createAgentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    role: zod_1.z.enum(constants_js_1.AGENT_ROLES).optional().default("general"),
    title: zod_1.z.string().optional().nullable(),
    icon: zod_1.z.enum(constants_js_1.AGENT_ICON_NAMES).optional().nullable(),
    reportsTo: zod_1.z.string().uuid().optional().nullable(),
    capabilities: zod_1.z.string().optional().nullable(),
    adapterType: zod_1.z.enum(constants_js_1.AGENT_ADAPTER_TYPES).optional().default("process"),
    adapterConfig: adapterConfigSchema.optional().default({}),
    runtimeConfig: zod_1.z.record(zod_1.z.unknown()).optional().default({}),
    budgetMonthlyCents: zod_1.z.number().int().nonnegative().optional().default(0),
    permissions: exports.agentPermissionsSchema.optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
});
exports.createAgentHireSchema = exports.createAgentSchema.extend({
    sourceIssueId: zod_1.z.string().uuid().optional().nullable(),
    sourceIssueIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.updateAgentSchema = exports.createAgentSchema
    .omit({ permissions: true })
    .partial()
    .extend({
    permissions: zod_1.z.never().optional(),
    status: zod_1.z.enum(constants_js_1.AGENT_STATUSES).optional(),
    spentMonthlyCents: zod_1.z.number().int().nonnegative().optional(),
});
exports.updateAgentInstructionsPathSchema = zod_1.z.object({
    path: zod_1.z.string().trim().min(1).nullable(),
    adapterConfigKey: zod_1.z.string().trim().min(1).optional(),
});
exports.createAgentKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).default("default"),
});
exports.wakeAgentSchema = zod_1.z.object({
    source: zod_1.z.enum(["timer", "assignment", "on_demand", "automation"]).optional().default("on_demand"),
    triggerDetail: zod_1.z.enum(["manual", "ping", "callback", "system"]).optional(),
    reason: zod_1.z.string().optional().nullable(),
    payload: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    idempotencyKey: zod_1.z.string().optional().nullable(),
    forceFreshSession: zod_1.z.preprocess(function (value) { return (value === null ? undefined : value); }, zod_1.z.boolean().optional().default(false)),
});
exports.resetAgentSessionSchema = zod_1.z.object({
    taskKey: zod_1.z.string().min(1).optional().nullable(),
});
exports.testAdapterEnvironmentSchema = zod_1.z.object({
    adapterConfig: adapterConfigSchema.optional().default({}),
});
exports.updateAgentPermissionsSchema = zod_1.z.object({
    canCreateAgents: zod_1.z.boolean(),
});
