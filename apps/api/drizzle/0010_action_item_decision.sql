ALTER TABLE "action_items" ADD COLUMN "decision_id" uuid;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_decision_id_idx" ON "action_items" USING btree ("decision_id");