"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchInstanceExperimentalSettingsSchema = exports.instanceExperimentalSettingsSchema = void 0;
var zod_1 = require("zod");
exports.instanceExperimentalSettingsSchema = zod_1.z.object({
    enableIsolatedWorkspaces: zod_1.z.boolean().default(false),
}).strict();
exports.patchInstanceExperimentalSettingsSchema = exports.instanceExperimentalSettingsSchema.partial();
