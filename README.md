# Agency

Agency is a Lovable-hosted React app that embeds the Delegation 3D office inside a dark operational shell and uses Supabase as the backend of record.

The app now includes:

- A `Cockpit` route with the Delegation 3D office, dark inspector, logs, and kanban
- A collapsible left navigation for `Dashboard`, `Inbox`, `Issues`, `Goals`, `Approvals`, `Projects`, `Org`, `Costs`, `Activity`, `Design Guide`, and `Settings`
- Supabase-ready data loading with a demo fallback so the UI still renders before the schema is applied
- Drizzle schema tooling for managing the same Supabase Postgres database without replacing Lovable’s frontend workflow

## Stack

- Vite
- React
- TypeScript
- shadcn/ui
- Tailwind CSS
- Supabase
- Drizzle ORM
- Three.js WebGPU

## Package manager

This repo should continue to use `npm` as the source of truth.

- Install with `npm install`
- Keep `package-lock.json`
- Do not switch this repo to `pnpm` or remove Lovable-managed dependencies

## Local development

```sh
npm install
npm run dev
```

The app will run even if the Supabase schema has not been applied yet. In that case it falls back to demo cockpit data.

## Supabase setup

The frontend client uses the generated Supabase integration under `src/integrations/supabase`.

Optional env overrides:

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

To create the database schema, apply:

- `supabase/migrations/202603110001_create_agency_cockpit.sql`

That migration creates:

- `companies`
- `agents`
- `projects`
- `goals`
- `issues`
- `approvals`
- `runs`
- `activity_events`

It also seeds an initial `Acme Delegation` company so the cockpit has live records as soon as the migration is applied.

## Drizzle

Drizzle is included for schema ownership and direct Postgres workflows against Supabase.

Env vars:

```sh
DATABASE_URL=postgresql://...
DATABASE_MIGRATION_URL=
PAPERCLIP_DB_DISABLE_PREPARED_STATEMENTS=false
```

Commands:

```sh
npm run db:generate
npm run db:push
npm run db:studio
```

`db/client.ts` automatically disables prepared statements for Supabase pooler hosts.

## Verification

```sh
npm test
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

## Notes

- The cockpit requires WebGPU for the 3D scene. Unsupported browsers get a clear fallback overlay instead of a blank panel.
- Until the Supabase schema exists, the app uses demo data and does not keep polling the missing tables.
- The left nav and page shell are intentionally dark so the embedded cockpit matches the outer app chrome.
