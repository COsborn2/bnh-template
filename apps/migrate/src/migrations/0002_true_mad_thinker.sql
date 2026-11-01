ALTER TABLE "user" ADD COLUMN "avatar_svg" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_options" jsonb DEFAULT '{}'::jsonb NOT NULL;