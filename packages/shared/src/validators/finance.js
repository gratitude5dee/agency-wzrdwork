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
exports.createFinanceEventSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
exports.createFinanceEventSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid().optional().nullable(),
    issueId: zod_1.z.string().uuid().optional().nullable(),
    projectId: zod_1.z.string().uuid().optional().nullable(),
    goalId: zod_1.z.string().uuid().optional().nullable(),
    heartbeatRunId: zod_1.z.string().uuid().optional().nullable(),
    costEventId: zod_1.z.string().uuid().optional().nullable(),
    billingCode: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().max(500).optional().nullable(),
    eventKind: zod_1.z.enum(constants_js_1.FINANCE_EVENT_KINDS),
    direction: zod_1.z.enum(constants_js_1.FINANCE_DIRECTIONS).optional().default("debit"),
    biller: zod_1.z.string().min(1),
    provider: zod_1.z.string().min(1).optional().nullable(),
    executionAdapterType: zod_1.z.enum(constants_js_1.AGENT_ADAPTER_TYPES).optional().nullable(),
    pricingTier: zod_1.z.string().min(1).optional().nullable(),
    region: zod_1.z.string().min(1).optional().nullable(),
    model: zod_1.z.string().min(1).optional().nullable(),
    quantity: zod_1.z.number().int().nonnegative().optional().nullable(),
    unit: zod_1.z.enum(constants_js_1.FINANCE_UNITS).optional().nullable(),
    amountCents: zod_1.z.number().int().nonnegative(),
    currency: zod_1.z.string().length(3).optional().default("USD"),
    estimated: zod_1.z.boolean().optional().default(false),
    externalInvoiceId: zod_1.z.string().optional().nullable(),
    metadataJson: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().nullable(),
    occurredAt: zod_1.z.string().datetime(),
}).transform(function (value) { return (__assign(__assign({}, value), { currency: value.currency.toUpperCase() })); });
