-- Add votes table for Reddit-like voting on predictions and comments.

CREATE TABLE IF NOT EXISTS "votes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "target_type" text NOT NULL,
  "target_id" integer NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "votes_user_target_uniq"
  ON "votes" ("user_id", "target_type", "target_id");

CREATE INDEX IF NOT EXISTS "votes_target_idx"
  ON "votes" ("target_type", "target_id");

CREATE INDEX IF NOT EXISTS "votes_user_idx"
  ON "votes" ("user_id");

