# CLI Reference

Complete guide to the Agency Synthesis command-line interface.

## Overview

The CLI provides administration and operation commands for managing the Agency platform, including database operations, configuration, and development utilities.

**Entry point:** `cli/src/index.ts`
**Build:** `npm run cli:build`
**Run:** `npm run cli:start -- <command> [options]`

## Installation

### From Source

```bash
npm run cli:build
npm run cli:start -- --help
```

### Via npm (published)

```bash
npm install -g @paperclipai/cli
paperclipai --help
```

## Command Structure

```
paperclipai <command> [subcommand] [options]
```

## Core Commands

### Configuration & Setup

#### `configure`

Interactive setup wizard for first-time configuration.

```bash
paperclipai configure
```

Guides through:
- Instance naming
- Database selection (embedded vs. external)
- Authentication mode
- LLM adapter setup
- Encryption key generation

#### `onboard`

Complete onboarding and system checks.

```bash
paperclipai onboard [--skip-checks]
```

Verifies:
- Node version (20+)
- Database connectivity
- Port availability
- Encryption key setup
- LLM adapter configuration

### Database Operations

#### `db:backup`

Create a database backup.

```bash
paperclipai db:backup [--instance default] [--location /path]
```

**Output:** `~/.paperclip/instances/<instance>/data/backups/backup-<timestamp>.sql`

#### `db:restore`

Restore from a previous backup.

```bash
paperclipai db:restore <backup-id> [--instance default]
```

**Example:**
```bash
paperclipai db:restore 2026-03-21_120000
```

#### `db:migrate`

Run pending migrations.

```bash
paperclipai db:migrate [--force] [--dry-run]
```

#### `db:seed`

Populate database with seed data.

```bash
paperclipai db:seed
```

Adds:
- Demo agents
- Sample companies
- Test users

#### `db:reset`

Reset database to clean state (development only).

```bash
paperclipai db:reset --confirm
```

⚠️ **Warning:** Deletes all data. Requires `--confirm` flag.

### Development

#### `dev`

Start development server with hot reload.

```bash
paperclipai dev [--port 3100] [--host 0.0.0.0]
```

Equivalent to: `npm run dev`

#### `build`

Build application for production.

```bash
paperclipai build [--mode production]
```

Outputs:
- `dist/index.js` — Server bundle
- `dist/ui/` — React bundle

### Instance Management

#### `instance:create`

Create a new isolated instance.

```bash
paperclipai instance:create <name> [--region us-west]
```

**Output:**
```
Instance 'staging' created at ~/.paperclip/instances/staging
ID: inst_abc123
Database: embedded
```

#### `instance:list`

List all instances.

```bash
paperclipai instance:list
```

Shows instance names, status, database type, location.

#### `instance:delete`

Delete an instance.

```bash
paperclipai instance:delete <name> --confirm
```

⚠️ **Warning:** Deletes data. Requires `--confirm`.

#### `instance:start`

Start an instance's server.

```bash
paperclipai instance:start <name> [--port 3100]
```

#### `instance:stop`

Stop an instance's server.

```bash
paperclipai instance:stop <name>
```

### Secrets & Configuration

#### `secrets:set`

Store encrypted secret.

```bash
paperclipai secrets:set <name> <value> [--instance default]
```

**Example:**
```bash
paperclipai secrets:set ANTHROPIC_API_KEY sk-...
```

#### `secrets:get`

Retrieve encrypted secret.

```bash
paperclipai secrets:get <name> [--instance default]
```

#### `secrets:list`

List all secrets (keys only, not values).

```bash
paperclipai secrets:list [--instance default]
```

#### `config:set`

Set configuration value.

```bash
paperclipai config:set <key> <value>
```

**Common configs:**
```bash
paperclipai config:set mode authenticated
paperclipai config:set port 3100
paperclipai config:set log_level debug
```

#### `config:get`

Get configuration value.

```bash
paperclipai config:get <key>
```

#### `config:show`

Display full configuration.

```bash
paperclipai config:show
```

### Diagnostics

#### `health`

Run system health check.

```bash
paperclipai health [--verbose]
```

Checks:
- Node version
- Database connectivity
- Port availability
- Disk space
- Memory
- LLM adapters

#### `info`

Display system information.

```bash
paperclipai info
```

Shows:
- Version
- Node version
- Platform
- Home directory
- Instance list

#### `logs`

Tail application logs.

```bash
paperclipai logs [--tail 100] [--follow] [--instance default]
```

**Example:**
```bash
paperclipai logs --follow --tail 50
```

### Release & Publishing

#### `release:publish`

Publish npm package (requires npm token).

```bash
paperclipai release:publish <version> [--channel stable|beta]
```

**Example:**
```bash
paperclipai release:publish 2026.318.0 --channel stable
```

#### `release:rollback`

Rollback to previous version.

```bash
paperclipai release:rollback <version>
```

## Global Options

These work with any command:

```bash
--instance <name>      # Specify instance (default: default)
--verbose, -v          # Verbose output
--quiet, -q            # Suppress output
--json                 # JSON output (for parsing)
--help, -h             # Show help
--version              # Show CLI version
```

## Environment Variables

Configuration via environment:

```bash
# CLI behavior
PAPERCLIP_INSTANCE=staging
PAPERCLIP_VERBOSE=true
PAPERCLIP_CONFIG_DIR=~/.config/paperclip

# Database
DATABASE_URL=postgresql://...

# Logging
LOG_LEVEL=debug
DEBUG=paperclip:*
```

## Examples

### Development Workflow

```bash
# Initial setup
paperclipai configure
paperclipai onboard

# Start development
paperclipai dev --port 3100

# Backup before changes
paperclipai db:backup

# Make changes...

# Restore if needed
paperclipai db:restore <backup-id>
```

### Multi-Instance Setup

```bash
# Create instances
paperclipai instance:create dev
paperclipai instance:create staging
paperclipai instance:create prod

# Start each with different ports
paperclipai instance:start dev --port 3100
paperclipai instance:start staging --port 3101
paperclipai instance:start prod --port 3102

# Migrate one instance
paperclipai db:migrate --instance staging

# Backup production
paperclipai db:backup --instance prod
```

### Production Release

```bash
# Build
paperclipai build

# Test
npm run test

# Publish
paperclipai release:publish 2026.318.0 --channel stable

# Check health
paperclipai health --verbose
```

## Command Implementation

Commands are defined in `cli/src/commands/`:

```
commands/
├── configure.ts
├── onboard.ts
├── db.ts (database subcommands)
├── instance.ts (instance management)
├── secrets.ts (secrets management)
├── health.ts
└── ...
```

## Configuration Files

CLI stores configuration in:

```
~/.paperclip/config.json       # Global config
~/.paperclip/instances/*/      # Per-instance data
  config.json
  data/postgres/               # Embedded DB
  data/backups/                # Database backups
```

## Exit Codes

```
0   — Success
1   — General error
2   — Usage error (wrong args)
3   — Configuration error
4   — Database error
5   — Network error
```

## Troubleshooting

### Command Not Found

```bash
npm run cli:build
npm run cli:start -- <command>
```

### Permission Denied

```bash
chmod +x cli/dist/index.js
```

### Database Lock

```bash
paperclipai instance:stop default
# Wait 5 seconds
paperclipai instance:start default
```

### Cannot Connect to Database

```bash
paperclipai health --verbose
# Check DATABASE_URL and port
```

## Next Steps

- See [DEVELOPING.md](./DEVELOPING.md) for dev setup
- Check [DATABASE.md](./DATABASE.md) for db operations
- Review [DEPLOYMENT-MODES.md](./DEPLOYMENT-MODES.md) for deployment
