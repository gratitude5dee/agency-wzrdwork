import type { IncomingMessage, ServerResponse } from "node:http";
import type { JsonObject } from "./types.js";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function noContent(response: ServerResponse) {
  response.statusCode = 204;
  response.end();
}

export async function readJson(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "JSON request body must be an object");
  }
  return parsed as JsonObject;
}

export function withCors(request: IncomingMessage, response: ServerResponse, origin: string) {
  const requestedOrigin = request.headers.origin ?? "*";
  response.setHeader(
    "access-control-allow-origin",
    origin === "*" ? requestedOrigin : origin,
  );
  response.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    "authorization,content-type,x-wallet-address,x-company-id",
  );
}

export function isOptionsRequest(request: IncomingMessage): boolean {
  return request.method === "OPTIONS";
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function asOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}
