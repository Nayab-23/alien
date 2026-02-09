-- Add comments table for social thread UI.
-- Apply with `npm run db:push` (recommended in this repo) or run manually in Postgres.

CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "prediction_id" integer NOT NULL REFERENCES "predictions"("id"),
  "author_user_id" integer NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "comments_prediction_idx" ON "comments" ("prediction_id");
CREATE INDEX IF NOT EXISTS "comments_author_idx" ON "comments" ("author_user_id");
CREATE INDEX IF NOT EXISTS "comments_created_at_idx" ON "comments" ("created_at");

