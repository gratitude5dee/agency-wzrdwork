"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertIssueDocumentSchema = exports.issueDocumentKeySchema = exports.issueDocumentFormatSchema = exports.ISSUE_DOCUMENT_FORMATS = exports.createIssueAttachmentMetadataSchema = exports.linkIssueApprovalSchema = exports.addIssueCommentSchema = exports.checkoutIssueSchema = exports.updateIssueSchema = exports.createIssueLabelSchema = exports.createIssueSchema = exports.issueAssigneeAdapterOverridesSchema = exports.issueExecutionWorkspaceSettingsSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
var executionWorkspaceStrategySchema = zod_1.z
    .object({
    type: zod_1.z.enum(["project_primary", "git_worktree", "adapter_managed", "cloud_sandbox"]).optional(),
    baseRef: zod_1.z.string().optional().nullable(),
    branchTemplate: zod_1.z.string().optional().nullable(),
    worktreeParentDir: zod_1.z.string().optional().nullable(),
    provisionCommand: zod_1.z.string().optional().nullable(),
    teardownCommand: zod_1.z.string().optional().nullable(),
})
    .strict();
exports.issueExecutionWorkspaceSettingsSchema = zod_1.z
    .object({
    mode: zod_1.z.enum(["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"]).optional(),
    workspaceStrategy: executionWorkspaceStrategySchema.optional().nullable(),
    workspaceRuntime: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
})
    .strict();
exports.issueAssigneeAdapterOverridesSchema = zod_1.z
    .object({
    adapterConfig: zod_1.z.record(zod_1.z.unknown()).optional(),
    useProjectWorkspace: zod_1.z.boolean().optional(),
})
    .strict();
exports.createIssueSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid().optional().nullable(),
    projectWorkspaceId: zod_1.z.string().uuid().optional().nullable(),
    goalId: zod_1.z.string().uuid().optional().nullable(),
    parentId: zod_1.z.string().uuid().optional().nullable(),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().nullable(),
    status: zod_1.z.enum(constants_js_1.ISSUE_STATUSES).optional().default("backlog"),
    priority: zod_1.z.enum(constants_js_1.ISSUE_PRIORITIES).optional().default("medium"),
    assigneeAgentId: zod_1.z.string().uuid().optional().nullable(),
    assigneeUserId: zod_1.z.string().optional().nullable(),
    requestDepth: zod_1.z.number().int().nonnegative().optional().default(0),
    billingCode: zod_1.z.string().optional().nullable(),
    assigneeAdapterOverrides: exports.issueAssigneeAdapterOverridesSchema.optional().nullable(),
    executionWorkspaceId: zod_1.z.string().uuid().optional().nullable(),
    executionWorkspacePreference: zod_1.z.enum([
        "inherit",
        "shared_workspace",
        "isolated_workspace",
        "operator_branch",
        "reuse_existing",
        "agent_default",
    ]).optional().nullable(),
    executionWorkspaceSettings: exports.issueExecutionWorkspaceSettingsSchema.optional().nullable(),
    labelIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.createIssueLabelSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(48),
    color: zod_1.z.string().regex(/^#(?:[0-9a-fA-F]{6})$/, "Color must be a 6-digit hex value"),
});
exports.updateIssueSchema = exports.createIssueSchema.partial().extend({
    comment: zod_1.z.string().min(1).optional(),
    hiddenAt: zod_1.z.string().datetime().nullable().optional(),
});
exports.checkoutIssueSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    expectedStatuses: zod_1.z.array(zod_1.z.enum(constants_js_1.ISSUE_STATUSES)).nonempty(),
});
exports.addIssueCommentSchema = zod_1.z.object({
    body: zod_1.z.string().min(1),
    reopen: zod_1.z.boolean().optional(),
    interrupt: zod_1.z.boolean().optional(),
});
exports.linkIssueApprovalSchema = zod_1.z.object({
    approvalId: zod_1.z.string().uuid(),
});
exports.createIssueAttachmentMetadataSchema = zod_1.z.object({
    issueCommentId: zod_1.z.string().uuid().optional().nullable(),
});
exports.ISSUE_DOCUMENT_FORMATS = ["markdown"];
exports.issueDocumentFormatSchema = zod_1.z.enum(exports.ISSUE_DOCUMENT_FORMATS);
exports.issueDocumentKeySchema = zod_1.z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Document key must be lowercase letters, numbers, _ or -");
exports.upsertIssueDocumentSchema = zod_1.z.object({
    title: zod_1.z.string().trim().max(200).nullable().optional(),
    format: exports.issueDocumentFormatSchema,
    body: zod_1.z.string().max(524288),
    changeSummary: zod_1.z.string().trim().max(500).nullable().optional(),
    baseRevisionId: zod_1.z.string().uuid().nullable().optional(),
});
