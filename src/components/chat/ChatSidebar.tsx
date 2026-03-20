/**
 * Chat Sidebar Component
 * Displays list of chat sessions with creation and management
 */

import { useCallback } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/stores/chatStore';
import { ChatSession } from '@/lib/hermes/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: ChatSidebarProps) {
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const store = useChatStore();

  const handleDeleteConfirm = useCallback(() => {
    if (deleteSessionId) {
      onDeleteSession(deleteSessionId);
      store.deleteSession(deleteSessionId);
      setDeleteSessionId(null);
    }
  }, [deleteSessionId, onDeleteSession, store]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="w-72 border-r border-white/10 flex flex-col bg-[#0d1118] h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-bold text-zinc-100">Chat</h2>
          </div>
        </div>
        <Button
          onClick={onNewChat}
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-3 w-3 mr-1.5" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-3">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-zinc-500">No chat sessions yet.</p>
              <p className="text-xs text-zinc-600 mt-1">Create one to get started.</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group rounded-lg border transition-colors cursor-pointer ${
                  activeSessionId === session.id
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-white/10 bg-transparent hover:bg-white/5'
                }`}
              >
                <button
                  onClick={() => onSelectSession(session.id)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">
                      {session.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {formatDate(session.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSessionId(session.id);
                    }}
                    className="shrink-0 ml-2 p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </button>
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteSessionId !== null} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent className="border-white/10 bg-[#0d1118]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the chat session and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
