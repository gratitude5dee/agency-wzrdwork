import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { Sql } from "postgres";
import {
  collectSecretIdentifiers,
  loadSecretValues,
  resolveSecretRefs,
} from "./secrets.js";
import type {
  AdapterExecutionModule,
  AdapterResolution,
  AdapterStepExecution,
  AdapterStepInput,
  JsonObject,
  ParsedAdapterOutput,
  TokenUsage,
} from "./types.js";
import {
  asBoolean,
  asInteger,
  asObject,
  asString,
  asStringArray,
  coerceJsonObject,
  enforceAllowedCommand,
  extractSummaryFromValue,
  normalizeUsage,
  parseJsonText,
} from "./utils.js";

export interface AdapterRegistry {
  get(adapterType: string): AdapterExecutionModule | undefined;
  resolveConfig(
    adapterType: string,
    companyId: string,
    rawConfig: JsonObject,
  ): Promise<AdapterResolution>;
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

interface CommandOptions {
  cwd: string;
  env?: Record<string, string>;
  stdin?: string;
  timeoutMs: number;
}

function buildStructuredStepPayload(input: AdapterStepInput): JsonObject {
  return {
    protocol: "agency-control-plane/m1",
    step: input.step,
    task: input.task,
    agent: {
      id: input.agent.id,
      name: input.agent.name,
      role: input.agent.role,
      adapterType: input.agent.adapter_type,
    },
    previousSteps: input.previousSteps.map((step) => ({
      step: step.step,
      summary: step.summary,
      data: step.data,
    })),
    instructions:
      "Return JSON with a top-level summary string and an optional data object describing the result.",
  };
}

async function runCommand(
  command: string,
  args: string[],
  options: CommandOptions,
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill("SIGTERM");
      reject(new Error(`Command timed out after ${options.timeoutMs}ms`));
    }, options.timeoutMs);

    proc.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    proc.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    proc.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode });
    });

    if (options.stdin) {
      proc.stdin.write(options.stdin);
    }
    proc.stdin.end();
  });
}

function normalizeScalarBinding(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  if ((record.type === "plain" || record.kind === "plain") && typeof record.value === "string") {
    return record.value;
  }
  return undefined;
}

function normalizeStringMap(input: unknown): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(asObject(input))) {
    const normalized = normalizeScalarBinding(value);
    if (normalized !== undefined) {
      output[key] = normalized;
      continue;
    }
    if (typeof value === "string") {
      output[key] = value;
    }
  }
  return output;
}

async function readInstructionsFile(filePath: string): Promise<string> {
  const trimmed = filePath.trim();
  if (!trimmed) return "";
  const contents = await fs.readFile(trimmed, "utf8");
  return contents.trim();
}

function buildCodexPrompt(input: AdapterStepInput, instructions: string): string {
  const previousSteps = input.previousSteps
    .map(
      (step) =>
        `Step: ${step.step}\nSummary: ${step.summary}\nData: ${JSON.stringify(step.data, null, 2)}`,
    )
    .join("\n\n");

  return [
    instructions,
    `You are executing the "${input.step}" step for agent "${input.agent.name}" (${input.agent.id}).`,
    `Task:\n${input.task}`,
    previousSteps ? `Previous step outputs:\n${previousSteps}` : "",
    `Return only JSON with this exact shape:
{
  "summary": "short summary",
  "data": {
    "step": "${input.step}",
    "result": {}
  }
}
Do not include markdown fences or commentary outside the JSON object.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseCodexJsonl(stdout: string): {
  summary: string;
  usage: TokenUsage;
  errorMessage: string | null;
} {
  const messages: string[] = [];
  let errorMessage: string | null = null;
  const usage: TokenUsage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const event = parseJsonText(line);
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const record = event as Record<string, unknown>;
    const type = asString(record.type);

    if (type === "error") {
      errorMessage = asString(record.message).trim() || errorMessage;
      continue;
    }

    if (type === "item.completed") {
      const item = asObject(record.item);
      if (asString(item.type) === "agent_message") {
        const text = asString(item.text).trim();
        if (text) messages.push(text);
      }
      continue;
    }

    if (type === "turn.completed") {
      const usageRecord = asObject(record.usage);
      usage.inputTokens = asInteger(usageRecord.input_tokens, usage.inputTokens);
      usage.cachedInputTokens = asInteger(
        usageRecord.cached_input_tokens,
        usage.cachedInputTokens,
      );
      usage.outputTokens = asInteger(usageRecord.output_tokens, usage.outputTokens);
      continue;
    }

    if (type === "turn.failed") {
      const errorRecord = asObject(record.error);
      errorMessage = asString(errorRecord.message).trim() || errorMessage;
    }
  }

  return {
    summary: messages.join("\n\n").trim(),
    usage,
    errorMessage,
  };
}

function parseGenericOutput(
  input: AdapterStepInput,
  execution: AdapterStepExecution,
): ParsedAdapterOutput {
  const stdout = execution.stdout.trim();
  const parsed = stdout ? parseJsonText(stdout) : null;
  const summary = extractSummaryFromValue(parsed ?? stdout, `${input.step} completed`);
  return {
    summary,
    data: coerceJsonObject(parsed ?? { summary, text: stdout }, summary),
    usage: execution.usage,
  };
}

async function resolveGenericSecrets(
  rawConfig: JsonObject,
  resolveMany: (identifiers: string[]) => Promise<Map<string, string>>,
): Promise<AdapterResolution> {
  const identifiers = Array.from(collectSecretIdentifiers(rawConfig).values()).flatMap(
    (entry) => entry.candidates,
  );
  const secretValues = await resolveMany(identifiers);
  return {
    config: asObject(resolveSecretRefs(rawConfig, secretValues)),
    sensitiveValues: Array.from(new Set(secretValues.values())),
  };
}

export function createAdapterRegistry(input: {
  sql: Sql;
  encryptionKey: Buffer;
  allowedProcessCommands: string[];
  allowedCodexCommands: string[];
  defaultCodexCommand: string;
}): AdapterRegistry {
  const resolveMany = async (
    companyId: string,
    identifiers: string[],
  ): Promise<Map<string, string>> => {
    return await loadSecretValues(input.sql, companyId, input.encryptionKey, identifiers);
  };

  const processAdapter: AdapterExecutionModule = {
    type: "process",
    async resolveSecrets(rawConfig): Promise<AdapterResolution> {
      return await resolveGenericSecrets(rawConfig, (identifiers) =>
        resolveMany((rawConfig.companyId as string) ?? "", identifiers),
      );
    },
    async executeStep(stepInput): Promise<AdapterStepExecution> {
      const config = stepInput.resolvedConfig;
      const command = asString(config.command).trim();
      enforceAllowedCommand(command, input.allowedProcessCommands, "process");
      const args = asStringArray(config.args);
      const cwd = path.resolve(asString(config.cwd, process.cwd()));
      const timeoutMs = Math.max(1_000, asInteger(config.timeoutSec, 30) * 1000);
      const result = await runCommand(command, args, {
        cwd,
        env: normalizeStringMap(config.env),
        stdin: JSON.stringify(buildStructuredStepPayload(stepInput), null, 2),
        timeoutMs,
      });

      if ((result.exitCode ?? 0) !== 0) {
        throw new Error(result.stderr.trim() || `Process exited with code ${result.exitCode}`);
      }

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        usage: normalizeUsage(),
      };
    },
    parseOutput: parseGenericOutput,
  };

  const httpAdapter: AdapterExecutionModule = {
    type: "http",
    async resolveSecrets(rawConfig): Promise<AdapterResolution> {
      return await resolveGenericSecrets(rawConfig, (identifiers) =>
        resolveMany((rawConfig.companyId as string) ?? "", identifiers),
      );
    },
    async executeStep(stepInput): Promise<AdapterStepExecution> {
      const config = stepInput.resolvedConfig;
      const url = asString(config.url).trim();
      if (!url) throw new Error("HTTP adapter url is required");

      const controller = new AbortController();
      const timeoutMs = Math.max(1_000, asInteger(config.timeoutMs, 15_000));
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: asString(config.method, "POST").toUpperCase(),
          headers: {
            "content-type": "application/json",
            ...normalizeStringMap(config.headers),
          },
          body: JSON.stringify(buildStructuredStepPayload(stepInput)),
          signal: controller.signal,
        });
        const body = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP adapter returned ${response.status}: ${body || response.statusText}`);
        }

        return {
          stdout: body,
          stderr: "",
          exitCode: 0,
          statusCode: response.status,
          usage: normalizeUsage(),
        };
      } finally {
        clearTimeout(timeout);
      }
    },
    parseOutput: parseGenericOutput,
  };

  const codexAdapter: AdapterExecutionModule = {
    type: "codex_local",
    async resolveSecrets(rawConfig): Promise<AdapterResolution> {
      const base = await resolveGenericSecrets(rawConfig, (identifiers) =>
        resolveMany((rawConfig.companyId as string) ?? "", identifiers),
      );
      return {
        config: {
          ...base.config,
          env: normalizeStringMap(base.config.env),
        },
        sensitiveValues: base.sensitiveValues,
      };
    },
    async executeStep(stepInput): Promise<AdapterStepExecution> {
      const config = stepInput.resolvedConfig;
      const command =
        asString(config.command).trim() || input.defaultCodexCommand;
      enforceAllowedCommand(command, input.allowedCodexCommands, "codex");
      const cwd = path.resolve(asString(config.cwd, process.cwd()));
      const instructions = await readInstructionsFile(asString(config.instructionsFilePath));
      const prompt = buildCodexPrompt(stepInput, instructions);
      const timeoutMs = Math.max(5_000, asInteger(config.timeoutSec, 120) * 1000);

      const args = ["exec", "--json"];
      if (asBoolean(config.search, false)) args.unshift("--search");
      if (
        asBoolean(config.dangerouslyBypassApprovalsAndSandbox, false) ||
        asBoolean(config.dangerouslyBypassSandbox, false)
      ) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
      }
      const model = asString(config.model).trim();
      if (model) args.push("--model", model);
      const reasoningEffort = asString(
        config.modelReasoningEffort,
        asString(config.reasoningEffort),
      ).trim();
      if (reasoningEffort) {
        args.push("-c", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
      }
      args.push(...asStringArray(config.extraArgs));
      args.push("-");

      const result = await runCommand(command, args, {
        cwd,
        env: normalizeStringMap(config.env),
        stdin: prompt,
        timeoutMs,
      });

      if ((result.exitCode ?? 0) !== 0) {
        throw new Error(result.stderr.trim() || `Codex exited with code ${result.exitCode}`);
      }

      const parsed = parseCodexJsonl(result.stdout);
      if (parsed.errorMessage) {
        throw new Error(parsed.errorMessage);
      }

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        usage: parsed.usage,
      };
    },
    parseOutput(stepInput, execution): ParsedAdapterOutput {
      const parsed = parseCodexJsonl(execution.stdout);
      const jsonCandidate = parsed.summary ? parseJsonText(parsed.summary) : null;
      const summary = extractSummaryFromValue(
        jsonCandidate ?? parsed.summary,
        `${stepInput.step} completed`,
      );
      return {
        summary,
        data: coerceJsonObject(jsonCandidate ?? { summary, text: parsed.summary }, summary),
        usage: parsed.usage,
      };
    },
  };

  const registry = new Map<string, AdapterExecutionModule>([
    ["process", processAdapter],
    ["http", httpAdapter],
    ["codex_local", codexAdapter],
  ]);

  return {
    get(adapterType: string): AdapterExecutionModule | undefined {
      return registry.get(adapterType);
    },
    async resolveConfig(
      adapterType: string,
      companyId: string,
      rawConfig: JsonObject,
    ): Promise<AdapterResolution> {
      const adapter = registry.get(adapterType);
      const configWithCompanyId = {
        ...rawConfig,
        companyId,
      };
      if (!adapter) {
        const base = await resolveGenericSecrets(configWithCompanyId, (identifiers) =>
          resolveMany(companyId, identifiers),
        );
        delete (base.config as Record<string, unknown>).companyId;
        return base;
      }

      const resolved = await adapter.resolveSecrets(
        configWithCompanyId,
        (identifiers) => resolveMany(companyId, identifiers),
      );
      delete (resolved.config as Record<string, unknown>).companyId;
      return resolved;
    },
  };
}
