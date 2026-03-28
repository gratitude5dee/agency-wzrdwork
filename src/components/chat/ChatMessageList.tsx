/**
 * Chat Message List Component
 * Displays scrollable message history with auto-scroll to newest messages
 */

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/lib/hermes/api';
import { ChatMessageItem } from './ChatMessageItem';
import { MessageCircle } from 'lucide-react';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  agentName?: string;
}

export function ChatMessageList({
  messages,
  isStreaming,
  streamingText,
  agentName = 'Assistant',
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming text updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <ScrollArea className="flex-1 h-full bg-[#020409]">
      <div className="w-full max-w-4xl mx-auto px-6 py-8">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex items-center justify-center flex-col gap-4">
            <div className="rounded-full bg-blue-600/20 p-4">
              <MessageCircle className="h-8 w-8 text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-zinc-200 mb-2">
                Start a conversation with {agentName}
              </h3>
              <p className="text-sm text-zinc-500">
                Send a message below to begin chatting with this agent.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Message List */}
            {messages.map((message) => (
              <ChatMessageItem key={message.id} message={message} />
            ))}

            {/* Streaming Message */}
            {isStreaming && streamingText && (
              <div className="flex gap-3 mb-4">
                <div className="shrink-0 h-8 w-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-zinc-600 animate-pulse" />
                </div>
                <div className="flex-1 max-w-2xl">
                  <div className="rounded-lg px-4 py-3 bg-zinc-900 border border-white/10">
                    <div className="text-sm text-zinc-100 whitespace-pre-wrap break-words">
                      {streamingText}
                      <span className="inline-block ml-1 w-2 h-5 bg-zinc-400 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </ScrollArea>
  );
}
