"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateIssueWorkProductSchema = exports.createIssueWorkProductSchema = exports.issueWorkProductReviewStateSchema = exports.issueWorkProductStatusSchema = exports.issueWorkProductTypeSchema = void 0;
var zod_1 = require("zod");
exports.issueWorkProductTypeSchema = zod_1.z.enum([
    "preview_url",
    "runtime_service",
    "pull_request",
    "branch",
    "commit",
    "artifact",
    "document",
]);
exports.issueWorkProductStatusSchema = zod_1.z.enum([
    "active",
    "ready_for_review",
    "approved",
    "changes_requested",
    "merged",
    "closed",
    "failed",
    "archived",
    "draft",
]);
exports.issueWorkProductReviewStateSchema = zod_1.z.enum([
    "none",
    "needs_board_review",
    "approved",
    "changes_requested",
]);
exports.createIssueWorkProductSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid().optional().nullable(),
    executionWorkspaceId: zod_1.z.string().uuid().optional().nullable(),
    runtimeServiceId: zod_1.z.string().uuid().optional().nullable(),
    type: exports.issueWorkProductTypeSchema,
    provider: zod_1.z.string().min(1),
    externalId: zod_1.z.string().optional().nullable(),
    title: zod_1.z.string().min(1),
    url: zod_1.z.string().url().optional().nullable(),
    status: exports.issueWorkProductStatusSchema.default("active"),
    reviewState: exports.issueWorkProductReviewStateSchema.optional().default("none"),
    isPrimary: zod_1.z.boolean().optional().default(false),
    healthStatus: zod_1.z.enum(["unknown", "healthy", "unhealthy"]).optional().default("unknown"),
    summary: zod_1.z.string().optional().nullable(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    createdByRunId: zod_1.z.string().uuid().optional().nullable(),
});
exports.updateIssueWorkProductSchema = exports.createIssueWorkProductSchema.partial();
