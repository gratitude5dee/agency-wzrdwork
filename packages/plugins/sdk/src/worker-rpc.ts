import type {
  PluginRpcError,
  PluginRpcFailureResponse,
  PluginRpcMessage,
  PluginRpcMethod,
  PluginRpcRequest,
  PluginRpcRequestMap,
  PluginRpcResponseMap,
  PluginRpcSuccessResponse,
} from "../../../shared/src/index.js";

export type {
  PluginRpcError,
  PluginRpcFailureResponse,
  PluginRpcMessage,
  PluginRpcMethod,
  PluginRpcRequest,
  PluginRpcRequestMap,
  PluginRpcResponseMap,
  PluginRpcSuccessResponse,
};

export interface PluginWorkerTransport {
  send(message: PluginRpcMessage): void;
  subscribe(listener: (message: PluginRpcMessage) => void): () => void;
}

export type PluginRpcHandler<TMethod extends PluginRpcMethod> = (
  params: PluginRpcRequestMap[TMethod],
) => Promise<PluginRpcResponseMap[TMethod]> | PluginRpcResponseMap[TMethod];

export type PluginRpcHandlerMap = {
  [TMethod in PluginRpcMethod]?: PluginRpcHandler<TMethod>;
};

export function createRpcError(
  code: string,
  message: string,
  details?: unknown,
): PluginRpcError {
  return { code, message, details };
}

export function createRequest<TMethod extends PluginRpcMethod>(
  id: string,
  method: TMethod,
  params: PluginRpcRequestMap[TMethod],
): PluginRpcRequest<TMethod> {
  return { id, method, params };
}

export function createSuccessResponse<TMethod extends PluginRpcMethod>(
  id: string,
  method: TMethod,
  result: PluginRpcResponseMap[TMethod],
): PluginRpcSuccessResponse<TMethod> {
  return { id, method, result };
}

export function createFailureResponse(
  id: string,
  method: PluginRpcMethod,
  error: PluginRpcError,
): PluginRpcFailureResponse {
  return { id, method, error };
}

export function createWorkerRpcServer(transport: PluginWorkerTransport, handlers: PluginRpcHandlerMap) {
  return transport.subscribe(async (message) => {
    if (!("method" in message) || !("params" in message)) {
      return;
    }

    const handler = handlers[message.method as PluginRpcMethod];
    if (!handler) {
      transport.send(
        createFailureResponse(
          message.id,
          message.method,
          createRpcError("METHOD_NOT_FOUND", `No handler registered for ${message.method}`),
        ),
      );
      return;
    }

    try {
      const result = await handler(message.params as never);
      transport.send(createSuccessResponse(message.id, message.method as never, result as never));
    } catch (error) {
      transport.send(
        createFailureResponse(
          message.id,
          message.method,
          createRpcError("HANDLER_FAILED", error instanceof Error ? error.message : "Handler failed", error),
        ),
      );
    }
  });
}
