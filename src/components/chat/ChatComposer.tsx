/**
 * Chat Composer Component
 * Message input with send button and agent/model selection
 */

import { useEffect, useRef, useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChatComposerProps {
  isStreaming: boolean;
  onSendMessage: (message: string) => void;
  selectedAgentId: string | null;
  onAgentChange: (agentId: string) => void;
  selectedModel: string | null;
  onModelChange: (model: string) => void;
  agents: Array<{ id: string; name: string }>;
  models: Array<{ id: string; name: string }>;
  hermesConnected: boolean;
}

export function ChatComposer({
  isStreaming,
  onSendMessage,
  selectedAgentId,
  onAgentChange,
  selectedModel,
  onModelChange,
  agents,
  models,
  hermesConnected,
}: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) {
        onSendMessage(message);
        setMessage('');
      }
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#0d1118] p-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {!hermesConnected && (
          <Alert className="border-yellow-500/30 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-100 text-xs ml-2">
              Hermes API is not connected. Messages will be stored locally.
            </AlertDescription>
          </Alert>
        )}

        {/* Controls Row */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
              Agent
            </label>
            <Select value={selectedAgentId || ''} onValueChange={onAgentChange}>
              <SelectTrigger className="bg-zinc-900 border-white/10 text-zinc-100 h-9">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                <SelectItem value="">None</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
              Model
            </label>
            <Select value={selectedModel || ''} onValueChange={onModelChange}>
              <SelectTrigger className="bg-zinc-900 border-white/10 text-zinc-100 h-9">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="bg-white/10" />

        {/* Message Input */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message... (Shift+Enter for newline)"
            disabled={isStreaming}
            className="bg-zinc-900 border-white/10 text-zinc-100 placeholder:text-zinc-600 resize-none min-h-[48px] max-h-[200px] pr-12"
          />

          <Button
            onClick={handleSend}
            disabled={isStreaming || !message.trim()}
            size="sm"
            className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Send</span>
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-[10px] text-zinc-500 px-1">
          Press Enter to send, Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
