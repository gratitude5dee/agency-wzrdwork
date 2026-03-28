"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paperclipConfigSchema = exports.secretsConfigSchema = exports.secretsLocalEncryptedConfigSchema = exports.storageConfigSchema = exports.storageS3ConfigSchema = exports.storageLocalDiskConfigSchema = exports.authConfigSchema = exports.serverConfigSchema = exports.loggingConfigSchema = exports.databaseConfigSchema = exports.databaseBackupConfigSchema = exports.llmConfigSchema = exports.configMetaSchema = void 0;
var zod_1 = require("zod");
var constants_js_1 = require("./constants.js");
exports.configMetaSchema = zod_1.z.object({
    version: zod_1.z.literal(1),
    updatedAt: zod_1.z.string(),
    source: zod_1.z.enum(["onboard", "configure", "doctor"]),
});
exports.llmConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(["claude", "openai"]),
    apiKey: zod_1.z.string().optional(),
});
exports.databaseBackupConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    intervalMinutes: zod_1.z.number().int().min(1).max(7 * 24 * 60).default(60),
    retentionDays: zod_1.z.number().int().min(1).max(3650).default(30),
    dir: zod_1.z.string().default("~/.paperclip/instances/default/data/backups"),
});
exports.databaseConfigSchema = zod_1.z.object({
    mode: zod_1.z.enum(["embedded-postgres", "postgres"]).default("embedded-postgres"),
    connectionString: zod_1.z.string().optional(),
    embeddedPostgresDataDir: zod_1.z.string().default("~/.paperclip/instances/default/db"),
    embeddedPostgresPort: zod_1.z.number().int().min(1).max(65535).default(54329),
    backup: exports.databaseBackupConfigSchema.default({
        enabled: true,
        intervalMinutes: 60,
        retentionDays: 30,
        dir: "~/.paperclip/instances/default/data/backups",
    }),
});
exports.loggingConfigSchema = zod_1.z.object({
    mode: zod_1.z.enum(["file", "cloud"]),
    logDir: zod_1.z.string().default("~/.paperclip/instances/default/logs"),
});
exports.serverConfigSchema = zod_1.z.object({
    deploymentMode: zod_1.z.enum(constants_js_1.DEPLOYMENT_MODES).default("local_trusted"),
    exposure: zod_1.z.enum(constants_js_1.DEPLOYMENT_EXPOSURES).default("private"),
    host: zod_1.z.string().default("127.0.0.1"),
    port: zod_1.z.number().int().min(1).max(65535).default(3100),
    allowedHostnames: zod_1.z.array(zod_1.z.string().min(1)).default([]),
    serveUi: zod_1.z.boolean().default(true),
});
exports.authConfigSchema = zod_1.z.object({
    baseUrlMode: zod_1.z.enum(constants_js_1.AUTH_BASE_URL_MODES).default("auto"),
    publicBaseUrl: zod_1.z.string().url().optional(),
    disableSignUp: zod_1.z.boolean().default(false),
});
exports.storageLocalDiskConfigSchema = zod_1.z.object({
    baseDir: zod_1.z.string().default("~/.paperclip/instances/default/data/storage"),
});
exports.storageS3ConfigSchema = zod_1.z.object({
    bucket: zod_1.z.string().min(1).default("paperclip"),
    region: zod_1.z.string().min(1).default("us-east-1"),
    endpoint: zod_1.z.string().optional(),
    prefix: zod_1.z.string().default(""),
    forcePathStyle: zod_1.z.boolean().default(false),
});
exports.storageConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(constants_js_1.STORAGE_PROVIDERS).default("local_disk"),
    localDisk: exports.storageLocalDiskConfigSchema.default({
        baseDir: "~/.paperclip/instances/default/data/storage",
    }),
    s3: exports.storageS3ConfigSchema.default({
        bucket: "paperclip",
        region: "us-east-1",
        prefix: "",
        forcePathStyle: false,
    }),
});
exports.secretsLocalEncryptedConfigSchema = zod_1.z.object({
    keyFilePath: zod_1.z.string().default("~/.paperclip/instances/default/secrets/master.key"),
});
exports.secretsConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(constants_js_1.SECRET_PROVIDERS).default("local_encrypted"),
    strictMode: zod_1.z.boolean().default(false),
    localEncrypted: exports.secretsLocalEncryptedConfigSchema.default({
        keyFilePath: "~/.paperclip/instances/default/secrets/master.key",
    }),
});
exports.paperclipConfigSchema = zod_1.z
    .object({
    $meta: exports.configMetaSchema,
    llm: exports.llmConfigSchema.optional(),
    database: exports.databaseConfigSchema,
    logging: exports.loggingConfigSchema,
    server: exports.serverConfigSchema,
    auth: exports.authConfigSchema.default({
        baseUrlMode: "auto",
        disableSignUp: false,
    }),
    storage: exports.storageConfigSchema.default({
        provider: "local_disk",
        localDisk: {
            baseDir: "~/.paperclip/instances/default/data/storage",
        },
        s3: {
            bucket: "paperclip",
            region: "us-east-1",
            prefix: "",
            forcePathStyle: false,
        },
    }),
    secrets: exports.secretsConfigSchema.default({
        provider: "local_encrypted",
        strictMode: false,
        localEncrypted: {
            keyFilePath: "~/.paperclip/instances/default/secrets/master.key",
        },
    }),
})
    .superRefine(function (value, ctx) {
    if (value.server.deploymentMode === "local_trusted") {
        if (value.server.exposure !== "private") {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "server.exposure must be private when deploymentMode is local_trusted",
                path: ["server", "exposure"],
            });
        }
        return;
    }
    if (value.auth.baseUrlMode === "explicit" && !value.auth.publicBaseUrl) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "auth.publicBaseUrl is required when auth.baseUrlMode is explicit",
            path: ["auth", "publicBaseUrl"],
        });
    }
    if (value.server.exposure === "public" && value.auth.baseUrlMode !== "explicit") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "auth.baseUrlMode must be explicit when deploymentMode=authenticated and exposure=public",
            path: ["auth", "baseUrlMode"],
        });
    }
    if (value.server.exposure === "public" && !value.auth.publicBaseUrl) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "auth.publicBaseUrl is required when deploymentMode=authenticated and exposure=public",
            path: ["auth", "publicBaseUrl"],
        });
    }
});
