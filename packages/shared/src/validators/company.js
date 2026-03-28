"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCompanySchema = exports.createCompanySchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
var logoAssetIdSchema = zod_1.z.string().uuid().nullable().optional();
exports.createCompanySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().nullable(),
    budgetMonthlyCents: zod_1.z.number().int().nonnegative().optional().default(0),
});
exports.updateCompanySchema = exports.createCompanySchema
    .partial()
    .extend({
    status: zod_1.z.enum(constants_js_1.COMPANY_STATUSES).optional(),
    spentMonthlyCents: zod_1.z.number().int().nonnegative().optional(),
    requireBoardApprovalForNewAgents: zod_1.z.boolean().optional(),
    brandColor: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    logoAssetId: logoAssetIdSchema,
});
