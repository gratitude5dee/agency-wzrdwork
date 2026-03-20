/**
 * Chat Store
 * Manages chat sessions, messages, and streaming state using Zustand
 */

import { create } from 'zustand';
import { ChatSession, ChatMessage } from '@/lib/hermes/api';

export interface ChatState {
  // State
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Map<string, ChatMessage[]>;
  isStreaming: boolean;
  streamingText: string;
  selectedAgentId: string | null;
  selectedModel: string | null;

  // Actions
  setActiveSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;
  setSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  deleteSession: (sessionId: string) => void;
  setSelectedAgentId: (agentId: string | null) => void;
  setSelectedModel: (model: string | null) => void;
  clearAll: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  sessions: [],
  activeSessionId: null,
  messages: new Map(),
  isStreaming: false,
  streamingText: '',
  selectedAgentId: null,
  selectedModel: null,

  // Actions
  setActiveSession: (id) =>
    set({
      activeSessionId: id,
      streamingText: '',
    }),

  addMessage: (sessionId, message) =>
    set((state) => {
      const messages = state.messages.get(sessionId) || [];
      return {
        messages: new Map(state.messages).set(sessionId, [...messages, message]),
      };
    }),

  updateMessage: (sessionId, messageId, updates) =>
    set((state) => {
      const messages = state.messages.get(sessionId) || [];
      const updated = messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      return {
        messages: new Map(state.messages).set(sessionId, updated),
      };
    }),

  setMessages: (sessionId, messages) =>
    set((state) => ({
      messages: new Map(state.messages).set(sessionId, messages),
    })),

  setStreaming: (streaming) =>
    set({
      isStreaming: streaming,
      ...(streaming ? {} : { streamingText: '' }),
    }),

  appendStreamingText: (text) =>
    set((state) => ({
      streamingText: state.streamingText + text,
    })),

  clearStreamingText: () =>
    set({
      streamingText: '',
    }),

  setSessions: (sessions) =>
    set({
      sessions,
    }),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId || session.id,
    })),

  deleteSession: (sessionId) =>
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== sessionId);
      const newMessages = new Map(state.messages);
      newMessages.delete(sessionId);
      return {
        sessions: newSessions,
        activeSessionId:
          state.activeSessionId === sessionId
            ? newSessions[0]?.id || null
            : state.activeSessionId,
        messages: newMessages,
      };
    }),

  setSelectedAgentId: (agentId) =>
    set({
      selectedAgentId: agentId,
    }),

  setSelectedModel: (model) =>
    set({
      selectedModel: model,
    }),

  clearAll: () =>
    set({
      sessions: [],
      activeSessionId: null,
      messages: new Map(),
      isStreaming: false,
      streamingText: '',
      selectedAgentId: null,
      selectedModel: null,
    }),
}));
