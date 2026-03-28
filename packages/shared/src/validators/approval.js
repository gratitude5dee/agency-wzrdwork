"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addApprovalCommentSchema = exports.resubmitApprovalSchema = exports.requestApprovalRevisionSchema = exports.resolveApprovalSchema = exports.createApprovalSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
exports.createApprovalSchema = zod_1.z.object({
    type: zod_1.z.enum(constants_js_1.APPROVAL_TYPES),
    requestedByAgentId: zod_1.z.string().uuid().optional().nullable(),
    payload: zod_1.z.record(zod_1.z.unknown()),
    issueIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.resolveApprovalSchema = zod_1.z.object({
    decisionNote: zod_1.z.string().optional().nullable(),
    decidedByUserId: zod_1.z.string().optional().default("board"),
});
exports.requestApprovalRevisionSchema = zod_1.z.object({
    decisionNote: zod_1.z.string().optional().nullable(),
    decidedByUserId: zod_1.z.string().optional().default("board"),
});
exports.resubmitApprovalSchema = zod_1.z.object({
    payload: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.addApprovalCommentSchema = zod_1.z.object({
    body: zod_1.z.string().min(1),
});
