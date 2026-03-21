/**
 * Plugin manifest parsing and validation.
 */

import type { PluginManifest } from "./types";

const REQUIRED_FIELDS: (keyof PluginManifest)[] = ["id", "name", "version", "slug", "permissions", "capabilities"];

/** Parse a raw JSON object into a validated PluginManifest. */
export function parsePluginManifest(raw: unknown): PluginManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid plugin manifest: expected an object");
  }
  const obj = raw as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new Error(`Invalid plugin manifest: missing required field "${field}"`);
    }
  }

  return {
    id: String(obj.id),
    name: String(obj.name),
    version: String(obj.version),
    slug: String(obj.slug),
    description: obj.description ? String(obj.description) : undefined,
    entrypoint: obj.entrypoint ? String(obj.entrypoint) : undefined,
    permissions: Array.isArray(obj.permissions) ? obj.permissions.map(String) : [],
    capabilities: Array.isArray(obj.capabilities) ? obj.capabilities.map(String) : [],
    configSchema: typeof obj.configSchema === "object" ? (obj.configSchema as Record<string, unknown>) : undefined,
  };
}

/** Validate a manifest has all required fields and correct types. */
export function validateManifest(manifest: PluginManifest): string[] {
  const errors: string[] = [];

  if (!manifest.id) errors.push("id is required");
  if (!manifest.name) errors.push("name is required");
  if (!manifest.version || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push("version must be semver format");
  }
  if (!manifest.slug || !/^[a-z0-9-]+$/.test(manifest.slug)) {
    errors.push("slug must be lowercase alphanumeric with hyphens");
  }

  return errors;
}
