"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSecretSchema = exports.rotateSecretSchema = exports.createSecretSchema = exports.envConfigSchema = exports.envBindingSchema = exports.envBindingSecretRefSchema = exports.envBindingPlainSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("../constants.js");
exports.envBindingPlainSchema = zod_1.z.object({
    type: zod_1.z.literal("plain"),
    value: zod_1.z.string(),
});
exports.envBindingSecretRefSchema = zod_1.z.object({
    type: zod_1.z.literal("secret_ref"),
    secretId: zod_1.z.string().uuid(),
    version: zod_1.z.union([zod_1.z.literal("latest"), zod_1.z.number().int().positive()]).optional(),
});
// Backward-compatible union that accepts legacy inline values.
exports.envBindingSchema = zod_1.z.union([
    zod_1.z.string(),
    exports.envBindingPlainSchema,
    exports.envBindingSecretRefSchema,
]);
exports.envConfigSchema = zod_1.z.record(exports.envBindingSchema);
exports.createSecretSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    provider: zod_1.z.enum(constants_js_1.SECRET_PROVIDERS).optional(),
    value: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().nullable(),
    externalRef: zod_1.z.string().optional().nullable(),
});
exports.rotateSecretSchema = zod_1.z.object({
    value: zod_1.z.string().min(1),
    externalRef: zod_1.z.string().optional().nullable(),
});
exports.updateSecretSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional().nullable(),
    externalRef: zod_1.z.string().optional().nullable(),
});
