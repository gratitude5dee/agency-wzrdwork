CREATE TABLE IF NOT EXISTS "agent_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"integration_key" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text,
	"agent_id" uuid,
	"model" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"content_blocks" jsonb,
	"tool_calls" jsonb,
	"tool_results" jsonb,
	"tokens_used" integer,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "wallet_address" text;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "budget_usd" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "prompt_template" text;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "wallet_address" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_integrations" ADD CONSTRAINT "agent_integrations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_integrations" ADD CONSTRAINT "agent_integrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_integrations_agent_id" ON "agent_integrations" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_integrations_company_id" ON "agent_integrations" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_integrations_integration_key" ON "agent_integrations" USING btree ("integration_key");
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_class WHERE relname = 'agent_integrations_agent_id_integration_key_idx'
 ) AND NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'agent_integrations_agent_id_integration_key_key'
 ) THEN
   CREATE UNIQUE INDEX "agent_integrations_agent_id_integration_key_idx" ON "agent_integrations" USING btree ("agent_id","integration_key");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_company_id" ON "chat_sessions" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_agent_id" ON "chat_sessions" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_status" ON "chat_sessions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_created_at" ON "chat_sessions" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_messages_session_id" ON "chat_messages" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_messages_role" ON "chat_messages" USING btree ("role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_messages_created_at" ON "chat_messages" USING btree ("created_at");
--> statement-breakpoint
ALTER TABLE "agent_integrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "public access" ON "agent_integrations";
--> statement-breakpoint
CREATE POLICY "public access" ON "agent_integrations" FOR ALL USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "public access" ON "chat_sessions";
--> statement-breakpoint
CREATE POLICY "public access" ON "chat_sessions" FOR ALL USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "public access" ON "chat_messages";
--> statement-breakpoint
CREATE POLICY "public access" ON "chat_messages" FOR ALL USING (true) WITH CHECK (true);
