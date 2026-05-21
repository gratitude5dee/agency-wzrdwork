CREATE TABLE IF NOT EXISTS "company_user_sidebar_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"project_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sidebar_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_user_sidebar_preferences" ADD CONSTRAINT "company_user_sidebar_preferences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_user_sidebar_preferences_company_idx" ON "company_user_sidebar_preferences" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_user_sidebar_preferences_user_idx" ON "company_user_sidebar_preferences" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_user_sidebar_preferences_company_user_uq" ON "company_user_sidebar_preferences" USING btree ("company_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_sidebar_preferences_user_uq" ON "user_sidebar_preferences" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "company_user_sidebar_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_sidebar_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "public access" ON "company_user_sidebar_preferences";
--> statement-breakpoint
DROP POLICY IF EXISTS "public access" ON "user_sidebar_preferences";
