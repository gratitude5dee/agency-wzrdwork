# Local Development Setup

This guide covers setting up the merged Agency Synthesis repository for local development.

## Prerequisites

- **Node.js 20+** (verify with `node --version`)
- **npm or pnpm** (pnpm recommended for monorepo)
- **Git** (for version control)
- **PostgreSQL 15+** (optional; embedded postgres auto-starts)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-org/agency-wzrdwork-main-work.git
cd agency-wzrdwork-main-work
npm install
# or
pnpm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Configure these required variables:

```env
# API Keys (optional for demo mode)
VITE_SUPABASE_URL=https://your-supabase.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Database (auto-detects embedded postgres if not set)
DATABASE_URL=postgresql://postgres:password@localhost:5432/paperclip

# Server Port
PORT=3100
SERVE_UI=true

# Encryption (required for control-plane)
CONTROL_PLANE_ENCRYPTION_KEY=your-base64-32-byte-key
```

### 3. Start Development

**Option A: All-in-one dev server** (recommended)

```bash
npm run dev
# Starts UI (http://localhost:5173) + server (http://localhost:3100)
```

**Option B: Separate terminals**

Terminal 1 (Server):
```bash
npm run dev:server
# Listens on http://localhost:3100
```

Terminal 2 (UI):
```bash
npm run dev:ui
# Listens on http://localhost:5173
```

## Database Setup

### Embedded Postgres (Default)

The app auto-starts embedded postgres on first run. Data persists in:

```
~/.paperclip/instances/default/data/postgres
```

To use the studio GUI:

```bash
npm run db:studio
```

### External Database

To use an external Postgres instance, set `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

Then run migrations:

```bash
npm run db:migrate:canonical
```

### Database Commands

- **Generate migrations:** `npm run db:generate`
- **Push schema:** `npm run db:push`
- **Run migrations:** `npm run db:migrate:canonical`
- **Seed data:** `npm run db:seed:canonical`
- **Backup:** `npm run db:backup`

## Project Structure

```
├── cli/                    # CLI entry point
├── server/                 # Express API server
├── ui/                     # Vite + React UI
├── packages/
│   ├── db/                # Drizzle ORM + migrations
│   ├── shared/            # Shared types and utils
│   ├── adapters/          # LLM adapters (Claude, Cursor, etc.)
│   ├── adapter-utils/     # Adapter utilities
│   └── plugins/           # Plugin framework
├── control-plane/         # Autonomous execution loop
└── docs/                  # Documentation
```

## Development Workflows

### Adding a New API Route

1. Create `server/src/routes/your-feature.ts`
2. Export router from `server/src/routes/index.ts`
3. Test with `npm test`

### Modifying the Database Schema

1. Edit `packages/db/src/schema/` files
2. Run `npm run db:generate` to create migration
3. Review and commit generated migration
4. Run `npm run db:push` to apply

### Modifying the UI

1. Edit files in `ui/src/` or root `src/`
2. Changes hot-reload automatically
3. Run `npm test` before committing

## Common Commands

```bash
npm run build              # Production build
npm run test               # Run all tests
npm run test:watch        # Watch mode
npm run lint              # ESLint check
npm run typecheck         # TypeScript check
npm run dev               # Start dev server
npm run db:studio         # Database GUI
npm run cli:start         # Run CLI
npm run server:start      # Run server standalone
npm run control-plane:start # Run control-plane service
```

## Troubleshooting

**Port 3100 already in use:**
```bash
# Change port
PORT=3101 npm run dev
```

**Database connection failed:**
- Check `DATABASE_URL` in `.env`
- Verify postgres is running: `psql -U postgres -h localhost`
- Reset embedded postgres: `rm -rf ~/.paperclip/instances/default`

**Module not found errors:**
- Clear cache: `rm -rf node_modules/.vite`
- Reinstall: `npm install`

**TypeScript errors:**
```bash
npm run typecheck
```

## Debugging

Enable detailed logging:

```bash
DEBUG=paperclip:* npm run dev
```

Inspect the database with Drizzle Studio:

```bash
npm run db:studio
```

Connect with external clients to `localhost:5432` (embedded postgres).

## Next Steps

- Read [DATABASE.md](./DATABASE.md) for schema details
- Check [DEPLOYMENT-MODES.md](./DEPLOYMENT-MODES.md) for deployment
- See [API.md](./API.md) for API reference
- Review [ADAPTERS.md](./ADAPTERS.md) for LLM integration
