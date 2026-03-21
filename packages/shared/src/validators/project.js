"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProjectSchema = exports.createProjectSchema = exports.updateProjectWorkspaceSchema = exports.createProjectWorkspaceSchema = exports.projectExecutionWorkspacePolicySchema = void 0;
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
exports.projectExecutionWorkspacePolicySchema = zod_1.z
    .object({
    enabled: zod_1.z.boolean(),
    defaultMode: zod_1.z.enum(["shared_workspace", "isolated_workspace", "operator_branch", "adapter_default"]).optional(),
    allowIssueOverride: zod_1.z.boolean().optional(),
    defaultProjectWorkspaceId: zod_1.z.string().uuid().optional().nullable(),
    workspaceStrategy: executionWorkspaceStrategySchema.optional().nullable(),
    workspaceRuntime: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    branchPolicy: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    pullRequestPolicy: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    runtimePolicy: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    cleanupPolicy: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
})
    .strict();
var projectWorkspaceSourceTypeSchema = zod_1.z.enum(["local_path", "git_repo", "remote_managed", "non_git_path"]);
var projectWorkspaceVisibilitySchema = zod_1.z.enum(["default", "advanced"]);
var projectWorkspaceFields = {
    name: zod_1.z.string().min(1).optional(),
    sourceType: projectWorkspaceSourceTypeSchema.optional(),
    cwd: zod_1.z.string().min(1).optional().nullable(),
    repoUrl: zod_1.z.string().url().optional().nullable(),
    repoRef: zod_1.z.string().optional().nullable(),
    defaultRef: zod_1.z.string().optional().nullable(),
    visibility: projectWorkspaceVisibilitySchema.optional(),
    setupCommand: zod_1.z.string().optional().nullable(),
    cleanupCommand: zod_1.z.string().optional().nullable(),
    remoteProvider: zod_1.z.string().optional().nullable(),
    remoteWorkspaceRef: zod_1.z.string().optional().nullable(),
    sharedWorkspaceKey: zod_1.z.string().optional().nullable(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
};
function validateProjectWorkspace(value, ctx) {
    var _a;
    var sourceType = (_a = value.sourceType) !== null && _a !== void 0 ? _a : "local_path";
    var hasCwd = typeof value.cwd === "string" && value.cwd.trim().length > 0;
    var hasRepo = typeof value.repoUrl === "string" && value.repoUrl.trim().length > 0;
    var hasRemoteRef = typeof value.remoteWorkspaceRef === "string" && value.remoteWorkspaceRef.trim().length > 0;
    if (sourceType === "remote_managed") {
        if (!hasRemoteRef && !hasRepo) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Remote-managed workspace requires remoteWorkspaceRef or repoUrl.",
                path: ["remoteWorkspaceRef"],
            });
        }
        return;
    }
    if (!hasCwd && !hasRepo) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Workspace requires at least one of cwd or repoUrl.",
            path: ["cwd"],
        });
    }
}
exports.createProjectWorkspaceSchema = zod_1.z.object(__assign(__assign({}, projectWorkspaceFields), { isPrimary: zod_1.z.boolean().optional().default(false) })).superRefine(validateProjectWorkspace);
exports.updateProjectWorkspaceSchema = zod_1.z.object(__assign(__assign({}, projectWorkspaceFields), { isPrimary: zod_1.z.boolean().optional() })).partial();
var projectFields = {
    /** @deprecated Use goalIds instead */
    goalId: zod_1.z.string().uuid().optional().nullable(),
    goalIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().nullable(),
    status: zod_1.z.enum(constants_js_1.PROJECT_STATUSES).optional().default("backlog"),
    leadAgentId: zod_1.z.string().uuid().optional().nullable(),
    targetDate: zod_1.z.string().optional().nullable(),
    color: zod_1.z.string().optional().nullable(),
    executionWorkspacePolicy: exports.projectExecutionWorkspacePolicySchema.optional().nullable(),
    archivedAt: zod_1.z.string().datetime().optional().nullable(),
};
exports.createProjectSchema = zod_1.z.object(__assign(__assign({}, projectFields), { workspace: exports.createProjectWorkspaceSchema.optional() }));
exports.updateProjectSchema = zod_1.z.object(projectFields).partial();
