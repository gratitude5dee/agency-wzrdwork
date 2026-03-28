# Chat Implementation - Quick Start Guide

## What Was Built

A complete Chat page with Hermes API integration that provides agent orchestration through a web interface.

## How to Use

### For Users
1. Click "Chat" in the app navigation (under top items)
2. Click "New Chat" to start a conversation
3. Select an agent (optional)
4. Select a model
5. Type your message
6. Press Enter to send
7. Watch real-time responses stream in

### For Developers

#### Accessing Chat Store
```typescript
import { useChatStore } from '@/stores/chatStore';

const store = useChatStore();
const { sessions, activeSessionId, messages } = store;
```

#### Sending Messages Programmatically
```typescript
import { sendMessage } from '@/lib/hermes/api';

const stream = await sendMessage('session-id', 'Your message', {
  agentId: 'agent-id',
  model: 'model-id'
});
```

#### Creating Sessions
```typescript
import { createSession } from '@/lib/hermes/api';

const session = await createSession(agentId, model);
```

## File Locations

All chat-related code is organized as follows:

```
src/
├── pages/Chat.tsx                    # Main page component
├── lib/hermes/
│   └── api.ts                        # API client
├── stores/
│   └── chatStore.ts                  # Zustand store
├── components/chat/
│   ├── ChatSidebar.tsx               # Session list
│   ├── ChatMessageList.tsx           # Message display
│   ├── ChatMessageItem.tsx           # Individual message
│   └── ChatComposer.tsx              # Input controls
└── hooks/
    └── useChatAgents.ts              # Agent loading hook
```

## Key Components

### ChatPage
The main component that orchestrates everything:
- Manages routing and session lifecycle
- Handles message sending and streaming
- Coordinates state with Zustand store

### ChatSidebar
Shows list of chat sessions:
- Create new sessions
- Switch between sessions
- Delete sessions with confirmation
- Shows timestamps and active state

### ChatMessageList
Displays the message history:
- Auto-scrolls to new messages
- Shows empty state initially
- Animates streaming text
- Responsive to window size

### ChatComposer
Input area with controls:
- Resizable textarea
- Agent selector
- Model selector
- Send button with keyboard shortcuts

### ChatMessageItem
Individual message rendering:
- User vs assistant styling
- Markdown rendering
- Tool call cards (collapsible)
- Metadata (time, tokens, model)

## Key Features

### Real-time Streaming
Messages stream in real-time using Server-Sent Events (SSE):
```typescript
for await (const chunk of parseHermesStream(stream)) {
  // Handle each chunk
  store.appendStreamingText(chunk.text);
}
```

### Session Management
Complete session lifecycle:
- Create new sessions
- Load session history
- Switch between sessions
- Delete sessions permanently

### Agent Selection
Pull agents from Supabase:
```typescript
const { agents } = useChatAgents();
// agents is Array<{ id: string; name: string }>
```

### Model Selection
Load available models from Hermes API:
```typescript
const models = await listModels();
// models is Array<{ id: string; name: string }>
```

## Theme & Styling

All components use the app's dark theme:

```css
/* Background */
bg-[#020409]    /* Main background */
bg-[#0d1118]    /* Card backgrounds */

/* Borders */
border-white/10

/* Text */
text-zinc-100   /* Primary text */
text-zinc-500   /* Secondary text */
text-zinc-300   /* Tertiary text */

/* Accent */
bg-blue-600     /* Buttons, highlights */
text-blue-400   /* Secondary accent */
```

## Configuration

### Hermes API URL
Set via environment variable:
```bash
VITE_HERMES_API_URL=http://127.0.0.1:8642
```

Default: `http://127.0.0.1:8642`

### Store Initialization
Store is initialized on first use (lazy):
```typescript
// First call creates the store
const store = useChatStore();
// Subsequent calls reuse it
```

## Common Tasks

### Add a New Session to Sidebar
```typescript
import { createSession } from '@/lib/hermes/api';
import { useChatStore } from '@/stores/chatStore';

const store = useChatStore();
const session = await createSession();
store.addSession(session);
```

### Get Current Messages
```typescript
const store = useChatStore();
const messages = store.messages.get(store.activeSessionId || '');
```

### Clear Store
```typescript
const store = useChatStore();
store.clearAll();
```

### Handle Streaming
```typescript
const stream = await sendMessage(sessionId, message);
if (stream) {
  for await (const chunk of parseHermesStream(stream)) {
    console.log('Chunk:', chunk);
  }
}
```

## API Endpoints

All endpoints are handled by the Hermes API client:

```
GET  /api/v1/chat/sessions              # List sessions
POST /api/v1/chat/sessions              # Create session
GET  /api/v1/chat/sessions/{id}/messages # Get history
POST /api/v1/chat/send                  # Send message (SSE stream)
GET  /api/v1/models                     # List models
```

## Error Handling

- **Hermes not running**: Shows yellow alert, stores locally
- **Network error**: Toast notification
- **Invalid session**: Redirects to new session
- **Stream error**: Logged to console, UI stays responsive

## Troubleshooting

### Chat not appearing in nav
- Ensure App.tsx and AppShell.tsx changes are applied
- Check that MessageSquare is imported in AppShell.tsx

### Messages not streaming
- Check Hermes API is running on localhost:8642
- Check browser console for errors
- Verify VITE_HERMES_API_URL environment variable

### Sessions not loading
- Hermes API may be offline (falls back gracefully)
- Check Supabase connection for agents
- Look at browser Network tab for API calls

### Styles not applying
- Ensure dark theme class is present (it's in AppShell)
- Check Tailwind CSS is configured correctly
- Verify shadcn/ui components are installed

## Performance Notes

- Lazy message loading (fetched on session switch)
- Auto-scroll only on new messages
- Efficient store updates with Map structure
- No re-renders on unrelated state changes
- Textarea height capped at 200px

## Security

- All API calls use HTTPS (in production)
- Supabase RLS policies protect agent data
- User messages stored server-side via Hermes
- No sensitive data in localStorage except session IDs
- CSRF protection via standard patterns

## Next Steps

1. **Test locally** - Visit /chat in the app
2. **Connect Hermes** - Ensure API is running
3. **Configure agents** - Add agents in Supabase
4. **Customize** - Add features as needed
5. **Deploy** - Use existing deployment pipeline

## Support & Documentation

- Full implementation guide: `/CHAT_IMPLEMENTATION.md`
- API types defined in: `/src/lib/hermes/api.ts`
- Store types defined in: `/src/stores/chatStore.ts`
- Component docs in file headers
