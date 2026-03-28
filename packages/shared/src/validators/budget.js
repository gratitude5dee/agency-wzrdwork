"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBudgetIncidentSchema = exports.upsertBudgetPolicySchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
exports.upsertBudgetPolicySchema = zod_1.z.object({
    scopeType: zod_1.z.enum(constants_js_1.BUDGET_SCOPE_TYPES),
    scopeId: zod_1.z.string().uuid(),
    metric: zod_1.z.enum(constants_js_1.BUDGET_METRICS).optional().default("billed_cents"),
    windowKind: zod_1.z.enum(constants_js_1.BUDGET_WINDOW_KINDS).optional().default("calendar_month_utc"),
    amount: zod_1.z.number().int().nonnegative(),
    warnPercent: zod_1.z.number().int().min(1).max(99).optional().default(80),
    hardStopEnabled: zod_1.z.boolean().optional().default(true),
    notifyEnabled: zod_1.z.boolean().optional().default(true),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.resolveBudgetIncidentSchema = zod_1.z.object({
    action: zod_1.z.enum(constants_js_1.BUDGET_INCIDENT_RESOLUTION_ACTIONS),
    amount: zod_1.z.number().int().nonnegative().optional(),
    decisionNote: zod_1.z.string().optional().nullable(),
}).superRefine(function (value, ctx) {
    if (value.action === "raise_budget_and_resume" && typeof value.amount !== "number") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "amount is required when raising a budget",
            path: ["amount"],
        });
    }
});
