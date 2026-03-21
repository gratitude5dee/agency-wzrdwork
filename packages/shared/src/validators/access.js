"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserCompanyAccessSchema = exports.updateMemberPermissionsSchema = exports.claimJoinRequestApiKeySchema = exports.listJoinRequestsQuerySchema = exports.acceptInviteSchema = exports.createOpenClawInvitePromptSchema = exports.createCompanyInviteSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
exports.createCompanyInviteSchema = zod_1.z.object({
    allowedJoinTypes: zod_1.z.enum(constants_js_1.INVITE_JOIN_TYPES).default("both"),
    defaultsPayload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().nullable(),
    agentMessage: zod_1.z.string().max(4000).optional().nullable(),
});
exports.createOpenClawInvitePromptSchema = zod_1.z.object({
    agentMessage: zod_1.z.string().max(4000).optional().nullable(),
});
exports.acceptInviteSchema = zod_1.z.object({
    requestType: zod_1.z.enum(constants_js_1.JOIN_REQUEST_TYPES),
    agentName: zod_1.z.string().min(1).max(120).optional(),
    adapterType: zod_1.z.enum(constants_js_1.AGENT_ADAPTER_TYPES).optional(),
    capabilities: zod_1.z.string().max(4000).optional().nullable(),
    agentDefaultsPayload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().nullable(),
    // OpenClaw join compatibility fields accepted at top level.
    responsesWebhookUrl: zod_1.z.string().max(4000).optional().nullable(),
    responsesWebhookMethod: zod_1.z.string().max(32).optional().nullable(),
    responsesWebhookHeaders: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().nullable(),
    paperclipApiUrl: zod_1.z.string().max(4000).optional().nullable(),
    webhookAuthHeader: zod_1.z.string().max(4000).optional().nullable(),
});
exports.listJoinRequestsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(constants_js_1.JOIN_REQUEST_STATUSES).optional(),
    requestType: zod_1.z.enum(constants_js_1.JOIN_REQUEST_TYPES).optional(),
});
exports.claimJoinRequestApiKeySchema = zod_1.z.object({
    claimSecret: zod_1.z.string().min(16).max(256),
});
exports.updateMemberPermissionsSchema = zod_1.z.object({
    grants: zod_1.z.array(zod_1.z.object({
        permissionKey: zod_1.z.enum(constants_js_1.PERMISSION_KEYS),
        scope: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().nullable(),
    })),
});
exports.updateUserCompanyAccessSchema = zod_1.z.object({
    companyIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
});
