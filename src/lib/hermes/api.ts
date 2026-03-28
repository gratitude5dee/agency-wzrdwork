/**
 * Hermes API Client
 * Handles streaming chat communication with the Hermes agent orchestration API
 */

const HERMES_API_BASE = import.meta.env.VITE_HERMES_API_URL || 'http://127.0.0.1:8642';

export interface ContentBlock {
  type: 'text' | 'thinking' | 'toolCall' | 'toolResult';
  text?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status?: 'pending' | 'running' | 'complete' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  content_blocks?: ContentBlock[];
  tool_calls?: ToolCall[];
  model?: string;
  tokens_used?: number;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  agent_id?: string;
  model?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * List available chat sessions
 */
export async function listSessions(): Promise<ChatSession[]> {
  try {
    const response = await fetch(`${HERMES_API_BASE}/api/v1/chat/sessions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.sessions || [];
  } catch (error) {
    console.warn('Failed to list sessions from Hermes API, returning empty list', error);
    return [];
  }
}

/**
 * Create a new chat session
 */
export async function createSession(agentId?: string, model?: string): Promise<ChatSession> {
  try {
    const response = await fetch(`${HERMES_API_BASE}/api/v1/chat/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        model: model,
        title: `Chat - ${new Date().toLocaleString()}`,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  } catch (error) {
    console.warn('Failed to create session via Hermes API', error);
    // Return a local session ID
    return {
      id: `local-${Date.now()}`,
      title: `Chat - ${new Date().toLocaleString()}`,
      agent_id: agentId,
      model: model,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Get chat history for a session
 */
export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  try {
    const response = await fetch(`${HERMES_API_BASE}/api/v1/chat/sessions/${sessionId}/messages`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.messages || [];
  } catch (error) {
    console.warn('Failed to get session history from Hermes API', error);
    return [];
  }
}

/**
 * Send a message and get streaming response
 * Returns the response body as a ReadableStream for SSE
 */
export async function sendMessage(
  sessionId: string,
  message: string,
  options?: {
    model?: string;
    agentId?: string;
  }
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const response = await fetch(`${HERMES_API_BASE}/api/v1/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_key: sessionId,
        message,
        model: options?.model,
        agent_id: options?.agentId,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Return the readable stream for SSE parsing
    return response.body;
  } catch (error) {
    console.warn('Failed to send message via Hermes API', error);
    return null;
  }
}

/**
 * List available models
 */
export async function listModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch(`${HERMES_API_BASE}/api/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.models || [];
  } catch (error) {
    console.warn('Failed to list models from Hermes API', error);
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20250219', name: 'Claude 3 Opus' },
    ];
  }
}

/**
 * Parse SSE stream from Hermes API
 */
export async function* parseHermesStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            yield JSON.parse(data);
          } catch (e) {
            console.warn('Failed to parse SSE message', e);
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6);
      if (data !== '[DONE]') {
        try {
          yield JSON.parse(data);
        } catch (e) {
          console.warn('Failed to parse final SSE message', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
