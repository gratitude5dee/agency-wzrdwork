"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExecutionWorkspaceSchema = exports.executionWorkspaceStatusSchema = void 0;
var zod_1 = require("zod");
exports.executionWorkspaceStatusSchema = zod_1.z.enum([
    "active",
    "idle",
    "in_review",
    "archived",
    "cleanup_failed",
]);
exports.updateExecutionWorkspaceSchema = zod_1.z.object({
    status: exports.executionWorkspaceStatusSchema.optional(),
    cleanupEligibleAt: zod_1.z.string().datetime().optional().nullable(),
    cleanupReason: zod_1.z.string().optional().nullable(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
}).strict();
