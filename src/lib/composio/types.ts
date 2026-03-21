/**
 * Composio / OpenClaw type definitions for plugin and tool discovery.
 */

export interface ComposioTool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
  requiredIntegration?: string;
}

export interface ComposioApp {
  key: string;
  name: string;
  description: string;
  logo?: string;
  tools: ComposioTool[];
  authType: "api_key" | "oauth2" | "none";
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  slug: string;
  description?: string;
  entrypoint?: string;
  permissions: string[];
  capabilities: string[];
  configSchema?: Record<string, unknown>;
}

export interface AdapterConfig {
  adapterType: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  integrations?: string[];
  overrides?: Record<string, unknown>;
}
