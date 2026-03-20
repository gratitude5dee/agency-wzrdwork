import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage, Server } from "node:http";
import type { Sql } from "postgres";
import type { LiveEvent, LiveEventHub, LiveSocketSession, ServerConfig } from "../types.js";
import { resolveActor, requireCompanyAccess } from "./access.js";
import { authenticateSessionToken } from "./auth.js";

function readUpgradeParams(request: IncomingMessage): {
  companyId: string | null;
  walletAddress: string | null;
  sessionToken: string | null;
  pathname: string;
} {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  return {
    pathname: url.pathname,
    companyId: url.searchParams.get("companyId"),
    walletAddress: url.searchParams.get("walletAddress"),
    sessionToken: url.searchParams.get("sessionToken"),
  };
}

class InMemoryLiveEventHub implements LiveEventHub {
  private readonly sessions = new Map<WebSocket, LiveSocketSession>();
  private wss: WebSocketServer | null = null;

  attach(server: Server, sql: Sql, config: ServerConfig): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", async (request, socket, head) => {
      const { pathname, companyId, walletAddress, sessionToken } = readUpgradeParams(request);
      if (pathname !== config.websocketPath) {
        return;
      }

      try {
        let actorWallet = walletAddress;
        let actor;
        if (sessionToken && sessionToken.trim() !== "") {
          const session = await authenticateSessionToken(sql, config, sessionToken);
          actor = session.actor;
          actorWallet = session.walletAddress;
        } else {
          actor = await resolveActor(sql, {
            companyId,
            walletAddress: config.trustWalletHeader ? walletAddress : null,
          });
        }

        if (companyId) {
          requireCompanyAccess(actor, companyId);
        }

        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.sessions.set(ws, {
            socket: ws,
            companyId,
            walletAddress: actorWallet ?? "",
          });

          ws.on("close", () => {
            this.sessions.delete(ws);
          });

          ws.send(JSON.stringify({
            type: "live.connected",
            companyId,
            payload: { status: "ok" },
            createdAt: new Date().toISOString(),
          }));
        });
      } catch {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
      }
    });
  }

  publish(event: Omit<LiveEvent, "createdAt">): void {
    const payload: LiveEvent = {
      ...event,
      createdAt: new Date().toISOString(),
    };
    const encoded = JSON.stringify(payload);

    for (const [socket, session] of this.sessions.entries()) {
      if (socket.readyState !== socket.OPEN) continue;
      if (payload.companyId && session.companyId && payload.companyId !== session.companyId) {
        continue;
      }
      socket.send(encoded);
    }
  }

  close(): void {
    for (const socket of this.sessions.keys()) {
      socket.close();
    }
    this.sessions.clear();
    this.wss?.close();
  }
}

export function createLiveEventHub(): LiveEventHub {
  return new InMemoryLiveEventHub();
}
