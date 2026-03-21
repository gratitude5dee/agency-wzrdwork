/**
 * Server API Module
 *
 * Re-exports all server-side API functions and utilities
 */

// Core HTTP utilities
export { getServerBaseUrl, getServerWebSocketUrl } from "./http";
export type { ServerActorContext } from "./http";
export { requestServerJson, requestServerVoid } from "./http";

// Entity APIs
export * from "./agents";
export * from "./approvals";
export * from "./auth";
export * from "./companies";
export * from "./dashboard";
export * from "./integrations";
export * from "./issues";
export * from "./sidebar-badges";
export * from "./actor";
export * from "./agency";
export * from "./session";

// Compatibility API Client (for Agency integration)
export * from "./compat-client";
export { compatApi } from "./compat-client";
