/**
 * Chat Page
 * Full-featured chat interface with agent orchestration via Hermes API
 * Supports streaming, multi-agent selection, and persistent session history
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useChatStore } from '@/stores/chatStore';
import { useChatAgents } from '@/hooks/useChatAgents';
import {
  listSessions,
  createSession,
  getSessionHistory,
  sendMessage,
  listModels,
  parseHermesStream,
  ChatMessage,
  ChatSession,
  ModelInfo,
} from '@/lib/hermes/api';

import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  args?: unknown;
  content?: string;
  result?: unknown;
}

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  // Store state
  const store = useChatStore();
  const activeSessionId = store.activeSessionId;
  const sessions = store.sessions;
  const messages = store.messages.get(activeSessionId || '') || [];
  const isStreaming = store.isStreaming;
  const streamingText = store.streamingText;
  const selectedAgentId = store.selectedAgentId;
  const selectedModel = store.selectedModel;

  // Local state
  const { agents } = useChatAgents();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hermesConnected, setHermesConnected] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(!sessionId);
  const currentSession = sessions.find((s) => s.id === activeSessionId);

  // Load models from Hermes API
  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const modelList = await listModels();
      setModels(modelList);
      setHermesConnected(modelList.length > 0);
      // Select first model if available
      if (modelList.length > 0 && !selectedModel) {
        store.setSelectedModel(modelList[0].id);
      }
    } catch (err) {
      console.warn('Failed to load models:', err);
      setHermesConnected(false);
    } finally {
      setIsLoadingModels(false);
    }
  }, [selectedModel, store]);

  // Load or create session
  const loadOrCreateSession = useCallback(async () => {
    try {
      if (sessionId) {
        // Use existing session from URL
        store.setActiveSession(sessionId);
        setIsLoadingHistory(true);
        const history = await getSessionHistory(sessionId);
        store.setMessages(sessionId, history);
      } else {
        // Create new session
        const newSession = await createSession();
        store.addSession(newSession);
        store.setActiveSession(newSession.id);
        navigate(`/chat/${newSession.id}`, { replace: true });
      }
    } catch (err) {
      console.warn('Failed to load/create session:', err);
      toast.error('Failed to load chat session');
    } finally {
      setIsLoadingHistory(false);
      setSessionLoading(false);
    }
  }, [sessionId, store, navigate]);

  // Load sessions list from Hermes API
  const loadSessions = useCallback(async () => {
    try {
      const sessionList = await listSessions();
      store.setSessions(sessionList);

      // If no active session and have sessions, set the first one
      if (!activeSessionId && sessionList.length > 0) {
        store.setActiveSession(sessionList[0].id);
      }
    } catch (err) {
      console.warn('Failed to load sessions:', err);
    }
  }, [activeSessionId, store]);

  // Initial load
  useEffect(() => {
    loadModels();
    loadSessions();
  }, [loadModels, loadSessions]);

  // Load or create session based on URL
  useEffect(() => {
    if (sessionId || (!activeSessionId && !sessionLoading)) {
      loadOrCreateSession();
    }
  }, [sessionId, activeSessionId, sessionLoading, loadOrCreateSession]);

  // Handle new chat
  const handleNewChat = useCallback(async () => {
    try {
      const newSession = await createSession(selectedAgentId || undefined, selectedModel || undefined);
      store.addSession(newSession);
      store.setActiveSession(newSession.id);
      navigate(`/chat/${newSession.id}`);
    } catch (err) {
      console.warn('Failed to create new session:', err);
      toast.error('Failed to create new chat');
    }
  }, [selectedAgentId, selectedModel, store, navigate]);

  // Handle sending message
  const handleSendMessage = useCallback(
    async (messageText: string) => {
      if (!activeSessionId) {
        toast.error('No active session');
        return;
      }

      // Add user message to store
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString(),
      };

      store.addMessage(activeSessionId, userMessage);

      // Send message and handle streaming
      store.setStreaming(true);
      store.clearStreamingText();

      try {
        const stream = await sendMessage(activeSessionId, messageText, {
          agentId: selectedAgentId || undefined,
          model: selectedModel || undefined,
        });

        if (stream) {
          // Parse SSE stream
          let assistantContent = '';
          const assistantId = `msg-${Date.now() + 1}`;

          try {
            for await (const chunk of parseHermesStream(stream)) {
              // Cast to ContentBlock for type safety
              const contentBlock = chunk as ContentBlock;
              // Handle different chunk types
              if (contentBlock.type === 'text_delta' && contentBlock.text) {
                assistantContent += contentBlock.text;
                store.appendStreamingText(contentBlock.text);
              } else if (contentBlock.type === 'tool_use' && contentBlock.name) {
                // Handle tool calls
                assistantContent += `\n[Calling: ${contentBlock.name}]\n`;
                store.appendStreamingText(`\n[Calling: ${contentBlock.name}]\n`);
              } else if (contentBlock.content) {
                // Fallback: treat content as text
                assistantContent += contentBlock.content;
                store.appendStreamingText(contentBlock.content);
              }
            }
          } catch (streamErr) {
            console.warn('Error parsing stream:', streamErr);
          }

          // Add final assistant message
          const assistantMessage: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: assistantContent || store.streamingText,
            model: selectedModel || undefined,
            created_at: new Date().toISOString(),
          };

          store.addMessage(activeSessionId, assistantMessage);
        } else {
          // Fallback: show a simple response if Hermes is not connected
          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content:
              "I'm currently unavailable (Hermes API not connected). Your message has been saved locally.",
            created_at: new Date().toISOString(),
          };
          store.addMessage(activeSessionId, assistantMessage);
        }
      } catch (err) {
        console.error('Error sending message:', err);
        toast.error('Failed to send message');
      } finally {
        store.setStreaming(false);
        store.clearStreamingText();
      }
    },
    [activeSessionId, selectedAgentId, selectedModel, store]
  );

  // Handle select session
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      navigate(`/chat/${sessionId}`);
      store.setActiveSession(sessionId);
      setIsLoadingHistory(true);
      getSessionHistory(sessionId).then((history) => {
        store.setMessages(sessionId, history);
        setIsLoadingHistory(false);
      });
    },
    [navigate, store]
  );

  // Handle delete session
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      // Could call API to delete from Hermes if implemented
      store.deleteSession(sessionId);
      navigate('/chat');
    } catch (err) {
      console.warn('Failed to delete session:', err);
      toast.error('Failed to delete session');
    }
  }, [store, navigate]);

  // Loading state
  if (sessionLoading || isLoadingHistory) {
    return (
      <div className="h-full flex items-center justify-center bg-[#020409]">
        <Card className="border-white/10 bg-[#0d1118] p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            <p className="text-sm text-zinc-300">Loading chat...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#020409]">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {currentSession && (
          <div className="shrink-0 border-b border-white/10 bg-[#0d1118] px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-zinc-100 truncate">{currentSession.title}</h2>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Started {new Date(currentSession.created_at).toLocaleDateString()}
                </p>
              </div>

              {selectedModel && (
                <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-300 ml-4 shrink-0">
                  {models.find((m) => m.id === selectedModel)?.name || selectedModel}
                </Badge>
              )}

              {selectedAgentId && (
                <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-300 ml-2 shrink-0">
                  {agents.find((a) => a.id === selectedAgentId)?.name || 'Agent'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Message List */}
        <ChatMessageList
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          agentName={selectedAgentId ? agents.find((a) => a.id === selectedAgentId)?.name : 'Assistant'}
        />

        {/* Composer */}
        <ChatComposer
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          selectedAgentId={selectedAgentId}
          onAgentChange={(agentId) => store.setSelectedAgentId(agentId || null)}
          selectedModel={selectedModel}
          onModelChange={(model) => store.setSelectedModel(model || null)}
          agents={agents}
          models={models}
          hermesConnected={hermesConnected}
        />
      </div>
    </div>
  );
}
