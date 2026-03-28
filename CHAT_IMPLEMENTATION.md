# Chat Page Implementation Guide

## Overview

A complete, production-ready Chat page has been implemented for the agency-wzrdwork-main app with Hermes-style agent orchestration. The implementation includes:

- Real-time streaming chat interface
- Multi-agent selection and model configuration
- Persistent session management
- Dark theme matching the existing UI
- Graceful fallback when Hermes API is unavailable
- All files fully typed with TypeScript
- No placeholders or TODOs

## Files Created

### Core Chat Page
- `/src/pages/Chat.tsx` - Main chat page component with full functionality

### API Client
- `/src/lib/hermes/api.ts` - Hermes API client with streaming support

### State Management
- `/src/stores/chatStore.ts` - Zustand store for chat state

### Components
- `/src/components/chat/ChatSidebar.tsx` - Session list sidebar with creation/deletion
- `/src/components/chat/ChatMessageItem.tsx` - Individual message rendering with markdown
- `/src/components/chat/ChatMessageList.tsx` - Scrollable message list with auto-scroll
- `/src/components/chat/ChatComposer.tsx` - Message input with controls

### Hooks
- `/src/hooks/useChatAgents.ts` - Hook for loading agents from Supabase

## Files Modified

### Routing
- `/src/App.tsx` - Added Chat import and two routes:
  - `/chat` - Main chat page
  - `/chat/:sessionId` - Chat with specific session

### Navigation
- `/src/features/cockpit/components/AppShell.tsx` - Added MessageSquare icon import and Chat nav item

## Architecture

### Data Flow

```
ChatPage (manages routing & session lifecycle)
  ├─ ChatSidebar (session list)
  ├─ ChatMessageList (message display)
  └─ ChatComposer (input & controls)
    └─ Hermes API
      ├─ SSE Stream Parsing
      └─ Message Content Blocks
```

### State Management

The Zustand store manages:
- Active session ID
- All messages per session (Map<sessionId, ChatMessage[]>)
- Streaming state and text
- Selected agent and model
- Session list

### API Integration

**Hermes API** (`http://127.0.0.1:8642`):
- List sessions: `GET /api/v1/chat/sessions`
- Create session: `POST /api/v1/chat/sessions`
- Get history: `GET /api/v1/chat/sessions/{id}/messages`
- Send message: `POST /api/v1/chat/send` (returns SSE stream)
- List models: `GET /api/v1/models`

**Fallbacks**:
- If Hermes API is unavailable, the app gracefully degrades
- Sessions and messages are stored locally
- Users are informed of the API status

## Features

### 1. Message Streaming
- Real-time SSE stream parsing from Hermes API
- Animated cursor during streaming
- Support for multiple content block types:
  - Text deltas
  - Tool calls with arguments and results
  - Thinking blocks (expandable)

### 2. Session Management
- Create new chat sessions
- View all sessions in sidebar with timestamps
- Switch between sessions instantly
- Delete sessions with confirmation
- Auto-load session history on switch

### 3. Agent & Model Selection
- Dropdown selectors for agents and models
- Agents loaded from Supabase `agents` table
- Models loaded from Hermes API
- Selection persists across messages in session

### 4. Message Rendering
- User messages: right-aligned, blue background
- Assistant messages: left-aligned, dark background
- Markdown support (bold, code blocks)
- Tool calls displayed as collapsible cards
- Token counts and model badges
- Timestamps for all messages

### 5. UI/UX
- Dark theme matching existing app (`bg-[#020409]`, `border-white/10`)
- Responsive layout with sidebar
- Auto-resize textarea
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Loading states and error handling
- Connection status indicator

## Configuration

### Environment Variables

Optional environment variable for custom Hermes API URL:
```env
VITE_HERMES_API_URL=http://127.0.0.1:8642
```

Default: `http://127.0.0.1:8642`

### Zustand Store

Access the chat store:
```typescript
import { useChatStore } from '@/stores/chatStore';

const store = useChatStore();
store.setActiveSession('session-id');
store.addMessage('session-id', message);
```

## Usage

### Navigate to Chat
Click "Chat" in the top navigation (new item added to AppShell)

### Create a Session
- Click "New Chat" button in sidebar
- Or open `/chat` which auto-creates a session

### Send Messages
1. Type in the message input
2. Select an agent (optional)
3. Select a model
4. Press Enter or click Send
5. Message streams in real-time

### Manage Sessions
- Click a session to switch
- Hover and click trash icon to delete
- All messages auto-load when switching

## Types

### ChatMessage
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  content_blocks?: ContentBlock[];
  tool_calls?: ToolCall[];
  model?: string;
  tokens_used?: number;
  created_at: string;
}
```

### ChatSession
```typescript
interface ChatSession {
  id: string;
  title: string;
  agent_id?: string;
  model?: string;
  created_at: string;
  updated_at: string;
}
```

### ContentBlock
```typescript
interface ContentBlock {
  type: 'text' | 'thinking' | 'toolCall' | 'toolResult';
  text?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
}
```

## Styling

All components use the existing dark theme:
- **Background**: `bg-[#020409]` (main), `bg-[#0d1118]` (cards)
- **Borders**: `border-white/10`
- **Text**: `text-zinc-100` (primary), `text-zinc-500` (secondary)
- **Accent**: Blue (`bg-blue-600`, `text-blue-400`)

All shadcn/ui components are used consistently with the app's design system.

## Error Handling

- **Missing Hermes API**: Shows yellow alert, stores locally
- **Network errors**: Toast notifications
- **Invalid session**: Redirects to new session
- **Missing agents**: Shows empty state with helpful message
- **Stream parsing errors**: Logged to console, doesn't break UI

## Performance

- Lazy message loading (fetch on session switch)
- Auto-scroll only on new messages
- Textarea auto-resize with height capping at 200px
- Efficient store updates with Map structure
- No re-renders on non-relevant state changes

## Future Enhancements

Potential additions for future versions:
- Message search and filtering
- Session export/import
- Collaborative chat
- File attachments
- Custom system prompts
- Chat history persistence in Supabase
- Conversation branching
- Rate limiting UI

## Testing

The implementation is fully typed and ready for:
- Unit tests on store actions
- Component tests with React Testing Library
- Integration tests with mock Hermes API
- E2E tests with Playwright

## Support

All files follow the app's:
- TypeScript conventions
- React patterns and hooks
- Zustand store patterns
- shadcn/ui component usage
- Styling patterns and theme

No external dependencies were added beyond what's already in the project.
