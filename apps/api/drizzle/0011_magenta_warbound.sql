CREATE TABLE "user_avatars" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_avatars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;