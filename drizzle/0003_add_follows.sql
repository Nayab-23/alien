-- Add follows table for following predictors.

CREATE TABLE IF NOT EXISTS "follows" (
  "id" serial PRIMARY KEY NOT NULL,
  "follower_user_id" integer NOT NULL REFERENCES "users"("id"),
  "followed_user_id" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "follows_follower_followed_uniq"
  ON "follows" ("follower_user_id", "followed_user_id");

CREATE INDEX IF NOT EXISTS "follows_follower_idx"
  ON "follows" ("follower_user_id");

CREATE INDEX IF NOT EXISTS "follows_followed_idx"
  ON "follows" ("followed_user_id");

