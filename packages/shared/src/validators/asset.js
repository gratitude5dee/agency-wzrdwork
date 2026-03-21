"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssetImageMetadataSchema = void 0;
var zod_1 = require("zod");
exports.createAssetImageMetadataSchema = zod_1.z.object({
    namespace: zod_1.z
        .string()
        .trim()
        .min(1)
        .max(120)
        .regex(/^[a-zA-Z0-9/_-]+$/)
        .optional(),
});
