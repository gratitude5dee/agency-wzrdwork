import { describe, expect, it } from "vitest";

import {
  API,
  ENVIRONMENT_DRIVERS,
  ENVIRONMENT_LEASE_CLEANUP_STATUSES,
  ENVIRONMENT_LEASE_STATUSES,
  ENVIRONMENT_STATUSES,
  createEnvironmentSchema,
  environmentDriverSchema,
  environmentLeaseCleanupStatusSchema,
  environmentLeaseStatusSchema,
  environmentStatusSchema,
  getEnvironmentCapabilities,
  probeEnvironmentConfigSchema,
  updateEnvironmentSchema,
} from "../../packages/shared/dist/index.js";

describe("environment shared contracts", () => {
  it("exports stable API handles for environment routes", () => {
    expect(API.environments).toBe("/api/companies/:companyId/environments");
    expect(API.environment).toBe("/api/environments/:environmentId");
    expect(API.environmentLeases).toBe("/api/environments/:environmentId/leases");
    expect(API.environmentLease).toBe("/api/environment-leases/:leaseId");
  });

  it("keeps environment constants aligned with validators", () => {
    expect(ENVIRONMENT_DRIVERS).toEqual(["local", "ssh", "sandbox", "plugin"]);
    expect(ENVIRONMENT_STATUSES).toEqual(["active", "archived"]);
    expect(ENVIRONMENT_LEASE_STATUSES).toEqual(["active", "released", "expired", "failed", "retained"]);
    expect(ENVIRONMENT_LEASE_CLEANUP_STATUSES).toEqual(["pending", "success", "failed"]);

    for (const driver of ENVIRONMENT_DRIVERS) {
      expect(environmentDriverSchema.parse(driver)).toBe(driver);
    }
    for (const status of ENVIRONMENT_STATUSES) {
      expect(environmentStatusSchema.parse(status)).toBe(status);
    }
    for (const status of ENVIRONMENT_LEASE_STATUSES) {
      expect(environmentLeaseStatusSchema.parse(status)).toBe(status);
    }
    for (const status of ENVIRONMENT_LEASE_CLEANUP_STATUSES) {
      expect(environmentLeaseCleanupStatusSchema.parse(status)).toBe(status);
    }
  });

  it("validates create, update, and probe payloads", () => {
    expect(createEnvironmentSchema.parse({
      name: "Local host",
      driver: "local",
    })).toEqual({
      name: "Local host",
      driver: "local",
      status: "active",
      config: {},
    });

    expect(updateEnvironmentSchema.parse({
      status: "archived",
      config: { provider: "fake" },
    })).toEqual({
      status: "archived",
      config: { provider: "fake" },
    });

    expect(probeEnvironmentConfigSchema.parse({
      name: "Probe",
      driver: "sandbox",
      config: { provider: "fake" },
    })).toEqual({
      name: "Probe",
      driver: "sandbox",
      config: { provider: "fake" },
    });

    expect(() => createEnvironmentSchema.parse({ name: "Broken", driver: "docker" })).toThrow();
  });

  it("exposes adapter capability metadata for remote-managed environments", () => {
    const capabilities = getEnvironmentCapabilities(["codex_local", "process"]);
    expect(capabilities.drivers).toEqual({
      local: "supported",
      ssh: "supported",
      sandbox: "supported",
      plugin: "unsupported",
    });
    expect(capabilities.adapters.find((adapter) => adapter.adapterType === "codex_local")?.drivers.ssh)
      .toBe("supported");
    expect(capabilities.adapters.find((adapter) => adapter.adapterType === "process")?.drivers.ssh)
      .toBe("unsupported");
  });
});
