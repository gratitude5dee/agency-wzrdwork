"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGoalSchema = exports.createGoalSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
exports.createGoalSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().nullable(),
    level: zod_1.z.enum(constants_js_1.GOAL_LEVELS).optional().default("task"),
    status: zod_1.z.enum(constants_js_1.GOAL_STATUSES).optional().default("planned"),
    parentId: zod_1.z.string().uuid().optional().nullable(),
    ownerAgentId: zod_1.z.string().uuid().optional().nullable(),
});
exports.updateGoalSchema = exports.createGoalSchema.partial();
