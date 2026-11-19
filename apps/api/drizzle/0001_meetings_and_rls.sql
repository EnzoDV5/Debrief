CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."meeting_source_type" AS ENUM('paste', 'txt', 'vtt', 'md');--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"meeting_date" date NOT NULL,
	"transcript_original" text NOT NULL,
	"transcript_lines" jsonb NOT NULL,
	"source_type" "meeting_source_type" NOT NULL,
	"summary" text,
	"analysis_status" "analysis_status" DEFAULT 'pending' NOT NULL,
	"analysis_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetings_user_id_created_at_idx" ON "meetings" USING btree ("user_id","created_at");