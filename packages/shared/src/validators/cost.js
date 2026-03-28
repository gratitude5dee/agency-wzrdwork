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
exports.updateBudgetSchema = exports.createCostEventSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
exports.createCostEventSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    issueId: zod_1.z.string().uuid().optional().nullable(),
    projectId: zod_1.z.string().uuid().optional().nullable(),
    goalId: zod_1.z.string().uuid().optional().nullable(),
    heartbeatRunId: zod_1.z.string().uuid().optional().nullable(),
    billingCode: zod_1.z.string().optional().nullable(),
    provider: zod_1.z.string().min(1),
    biller: zod_1.z.string().min(1).optional(),
    billingType: zod_1.z.enum(constants_js_1.BILLING_TYPES).optional().default("unknown"),
    model: zod_1.z.string().min(1),
    inputTokens: zod_1.z.number().int().nonnegative().optional().default(0),
    cachedInputTokens: zod_1.z.number().int().nonnegative().optional().default(0),
    outputTokens: zod_1.z.number().int().nonnegative().optional().default(0),
    costCents: zod_1.z.number().int().nonnegative(),
    occurredAt: zod_1.z.string().datetime(),
}).transform(function (value) {
    var _a;
    return (__assign(__assign({}, value), { biller: (_a = value.biller) !== null && _a !== void 0 ? _a : value.provider }));
});
exports.updateBudgetSchema = zod_1.z.object({
    budgetMonthlyCents: zod_1.z.number().int().nonnegative(),
});
