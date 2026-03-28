"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyPortabilityImportSchema = exports.companyPortabilityPreviewSchema = exports.companyPortabilityExportSchema = exports.portabilityCollisionStrategySchema = exports.portabilityAgentSelectionSchema = exports.portabilityTargetSchema = exports.portabilitySourceSchema = exports.portabilityManifestSchema = exports.portabilityAgentManifestEntrySchema = exports.portabilityCompanyManifestEntrySchema = exports.portabilitySecretRequirementSchema = exports.portabilityIncludeSchema = void 0;
var zod_1 = require("zod");
exports.portabilityIncludeSchema = zod_1.z
    .object({
    company: zod_1.z.boolean().optional(),
    agents: zod_1.z.boolean().optional(),
})
    .partial();
exports.portabilitySecretRequirementSchema = zod_1.z.object({
    key: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable(),
    agentSlug: zod_1.z.string().min(1).nullable(),
    providerHint: zod_1.z.string().nullable(),
});
exports.portabilityCompanyManifestEntrySchema = zod_1.z.object({
    path: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable(),
    brandColor: zod_1.z.string().nullable(),
    requireBoardApprovalForNewAgents: zod_1.z.boolean(),
});
exports.portabilityAgentManifestEntrySchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    path: zod_1.z.string().min(1),
    role: zod_1.z.string().min(1),
    title: zod_1.z.string().nullable(),
    icon: zod_1.z.string().nullable(),
    capabilities: zod_1.z.string().nullable(),
    reportsToSlug: zod_1.z.string().min(1).nullable(),
    adapterType: zod_1.z.string().min(1),
    adapterConfig: zod_1.z.record(zod_1.z.unknown()),
    runtimeConfig: zod_1.z.record(zod_1.z.unknown()),
    permissions: zod_1.z.record(zod_1.z.unknown()),
    budgetMonthlyCents: zod_1.z.number().int().nonnegative(),
    metadata: zod_1.z.record(zod_1.z.unknown()).nullable(),
});
exports.portabilityManifestSchema = zod_1.z.object({
    schemaVersion: zod_1.z.number().int().positive(),
    generatedAt: zod_1.z.string().datetime(),
    source: zod_1.z
        .object({
        companyId: zod_1.z.string().uuid(),
        companyName: zod_1.z.string().min(1),
    })
        .nullable(),
    includes: zod_1.z.object({
        company: zod_1.z.boolean(),
        agents: zod_1.z.boolean(),
    }),
    company: exports.portabilityCompanyManifestEntrySchema.nullable(),
    agents: zod_1.z.array(exports.portabilityAgentManifestEntrySchema),
    requiredSecrets: zod_1.z.array(exports.portabilitySecretRequirementSchema).default([]),
});
exports.portabilitySourceSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({
        type: zod_1.z.literal("inline"),
        manifest: exports.portabilityManifestSchema,
        files: zod_1.z.record(zod_1.z.string()),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("url"),
        url: zod_1.z.string().url(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("github"),
        url: zod_1.z.string().url(),
    }),
]);
exports.portabilityTargetSchema = zod_1.z.discriminatedUnion("mode", [
    zod_1.z.object({
        mode: zod_1.z.literal("new_company"),
        newCompanyName: zod_1.z.string().min(1).optional().nullable(),
    }),
    zod_1.z.object({
        mode: zod_1.z.literal("existing_company"),
        companyId: zod_1.z.string().uuid(),
    }),
]);
exports.portabilityAgentSelectionSchema = zod_1.z.union([
    zod_1.z.literal("all"),
    zod_1.z.array(zod_1.z.string().min(1)),
]);
exports.portabilityCollisionStrategySchema = zod_1.z.enum(["rename", "skip", "replace"]);
exports.companyPortabilityExportSchema = zod_1.z.object({
    include: exports.portabilityIncludeSchema.optional(),
});
exports.companyPortabilityPreviewSchema = zod_1.z.object({
    source: exports.portabilitySourceSchema,
    include: exports.portabilityIncludeSchema.optional(),
    target: exports.portabilityTargetSchema,
    agents: exports.portabilityAgentSelectionSchema.optional(),
    collisionStrategy: exports.portabilityCollisionStrategySchema.optional(),
});
exports.companyPortabilityImportSchema = exports.companyPortabilityPreviewSchema;
