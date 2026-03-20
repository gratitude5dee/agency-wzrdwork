/**
 * Chat Message Item Component
 * Renders individual messages with markdown support and tool indicators
 */

import { ChatMessage, ToolCall } from '@/lib/hermes/api';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react';
import { useState } from 'react';

interface ChatMessageItemProps {
  message: ChatMessage;
}

function renderMarkdown(text: string): React.ReactNode {
  // Simple markdown rendering
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Code blocks
  const codeRegex = /```([^\n]*)\n([\s\S]*?)```/g;
  let match;
  const codeMatches: Array<{ index: number; match: string; lang: string; code: string }> = [];

  while ((match = codeRegex.exec(text)) !== null) {
    codeMatches.push({
      index: match.index,
      match: match[0],
      lang: match[1] || 'text',
      code: match[2],
    });
  }

  // Process code blocks
  if (codeMatches.length > 0) {
    for (const cb of codeMatches) {
      if (cb.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {renderSimpleMarkdown(text.slice(lastIndex, cb.index))}
          </span>
        );
      }
      parts.push(
        <pre
          key={`code-${cb.index}`}
          className="bg-zinc-900 border border-white/10 rounded p-3 my-2 overflow-x-auto text-xs"
        >
          <code className="text-zinc-200 font-mono">{cb.code.trim()}</code>
        </pre>
      );
      lastIndex = cb.index + cb.match.length;
    }
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{renderSimpleMarkdown(text.slice(lastIndex))}</span>
      );
    }
  } else {
    parts.push(renderSimpleMarkdown(text));
  }

  return parts.length === 0 ? text : parts;
}

function renderSimpleMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Bold: **text** -> <strong>
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`bold-${match.index}`} className="font-semibold">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="border-white/10 bg-zinc-900/50 p-3 my-2 cursor-pointer hover:bg-zinc-900/70 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-mono font-medium text-blue-400">{toolCall.name}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Status: {toolCall.status || 'unknown'}
          </p>
        </div>
        <svg
          className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-2">
          <div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase">Arguments</p>
            <pre className="bg-black/50 rounded p-2 mt-1 text-[10px] overflow-x-auto">
              <code className="text-zinc-300 font-mono">
                {JSON.stringify(toolCall.args, null, 2)}
              </code>
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase">Result</p>
              <pre className="bg-black/50 rounded p-2 mt-1 text-[10px] overflow-x-auto">
                <code className="text-zinc-300 font-mono">
                  {typeof toolCall.result === 'string'
                    ? toolCall.result
                    : JSON.stringify(toolCall.result, null, 2)}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <Avatar className="shrink-0 h-8 w-8 border border-white/10">
        {isUser ? (
          <AvatarFallback className="bg-blue-600/20">
            <User className="h-4 w-4 text-blue-400" />
          </AvatarFallback>
        ) : (
          <AvatarFallback className="bg-zinc-800">
            <Bot className="h-4 w-4 text-zinc-400" />
          </AvatarFallback>
        )}
      </Avatar>

      {/* Message Content */}
      <div className={`flex-1 max-w-2xl ${isUser ? 'text-right' : ''}`}>
        <div
          className={`rounded-lg px-4 py-3 mb-1 ${
            isUser ? 'bg-blue-600/20 border border-blue-500/30' : isSystem ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-zinc-900 border border-white/10'
          }`}
        >
          <div className={`text-sm ${isUser ? 'text-blue-100' : 'text-zinc-100'}`}>
            {renderMarkdown(message.content)}
          </div>
        </div>

        {/* Tool Calls */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className={`space-y-2 ${isUser ? 'mr-auto' : ''}`}>
            {message.tool_calls.map((toolCall) => (
              <ToolCallCard key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className={`flex gap-2 mt-2 text-[10px] text-zinc-500 ${isUser ? 'justify-end' : ''}`}>
          <span>{new Date(message.created_at).toLocaleTimeString()}</span>
          {message.model && <span>•</span>}
          {message.model && <Badge variant="outline" className="border-white/10 text-[10px] h-fit">{message.model}</Badge>}
          {message.tokens_used && (
            <>
              <span>•</span>
              <span>{message.tokens_used} tokens</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
