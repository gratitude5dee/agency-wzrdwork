import { getServerSessionToken } from "./session";

export interface ServerActorContext {
  walletAddress?: string | null;
  companyId?: string | null;
}

export function getServerBaseUrl(): string | null {
  const value = import.meta.env.VITE_SERVER_URL as string | undefined;
  return value ? value.replace(/\/$/, "") : null;
}

export function getServerWebSocketUrl(): string | null {
  const explicit = import.meta.env.VITE_SERVER_WS_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");

  const baseUrl = getServerBaseUrl();
  if (!baseUrl) return null;

  if (baseUrl.startsWith("https://")) {
    return `wss://${baseUrl.slice("https://".length)}/ws/live`;
  }
  if (baseUrl.startsWith("http://")) {
    return `ws://${baseUrl.slice("http://".length)}/ws/live`;
  }
  return null;
}

function buildHeaders(actor?: ServerActorContext, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json");
  const sessionToken = getServerSessionToken();
  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }
  if (actor?.walletAddress) {
    headers.set("x-wallet-address", actor.walletAddress);
  }
  if (actor?.companyId) {
    headers.set("x-company-id", actor.companyId);
  }
  return headers;
}

export async function requestServerJson<T>(
  path: string,
  input: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    actor?: ServerActorContext;
    headers?: HeadersInit;
  } = {},
): Promise<T> {
  const baseUrl = getServerBaseUrl();
  if (!baseUrl) {
    throw new Error("VITE_SERVER_URL is not configured");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: input.method ?? "GET",
    headers: buildHeaders(input.actor, input.headers),
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Server request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export async function requestServerVoid(
  path: string,
  input: {
    method?: "POST" | "PATCH" | "DELETE";
    body?: unknown;
    actor?: ServerActorContext;
    headers?: HeadersInit;
  },
): Promise<void> {
  await requestServerJson<unknown>(path, input);
}
