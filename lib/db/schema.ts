import { pgTable, text, integer, uniqueIndex, index, serial, timestamp } from "drizzle-orm/pg-core";

// ─── users ──────────────────────────────────────────────────────────────────
// Anchored to Alien verified identity via alienId (JWT sub claim).
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    alienId: text("alien_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    alienIdIdx: uniqueIndex("users_alien_id_uniq").on(table.alienId),
  })
);

// ─── predictions ────────────────────────────────────────────────────────────
export const predictionStatus = ["open", "settled", "cancelled"] as const;
export type PredictionStatus = (typeof predictionStatus)[number];

export const predictionDirection = ["up", "down"] as const;
export type PredictionDirection = (typeof predictionDirection)[number];

export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    creatorUserId: integer("creator_user_id")
      .notNull()
      .references(() => users.id),
    assetSymbol: text("asset_symbol").notNull(),
    direction: text("direction", { enum: predictionDirection }).notNull(),
    timeframeEnd: timestamp("timeframe_end").notNull(),
    confidence: integer("confidence").notNull(),
    status: text("status", { enum: predictionStatus })
      .notNull()
      .default("open"),
    settlementPrice: text("settlement_price"),
    settlementTimestamp: timestamp("settlement_timestamp"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    creatorIdx: index("predictions_creator_idx").on(table.creatorUserId),
    statusIdx: index("predictions_status_idx").on(table.status),
    timeframeEndIdx: index("predictions_timeframe_end_idx").on(
      table.timeframeEnd
    ),
  })
);

// ─── stakes ─────────────────────────────────────────────────────────────────
export const stakeSide = ["for", "against"] as const;
export type StakeSide = (typeof stakeSide)[number];

export const paymentStatus = ["pending", "completed", "failed"] as const;
export type PaymentStatus = (typeof paymentStatus)[number];

export const stakes = pgTable(
  "stakes",
  {
    id: serial("id").primaryKey(),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    side: text("side", { enum: stakeSide }).notNull(),
    amount: text("amount").notNull(),
    currency: text("currency").notNull(),
    network: text("network").notNull().default("solana"),
    invoiceId: text("invoice_id"),
    paymentStatus: text("payment_status", { enum: paymentStatus })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdIdx: uniqueIndex("stakes_invoice_id_uniq").on(table.invoiceId),
    predictionIdx: index("stakes_prediction_idx").on(table.predictionId),
    userIdx: index("stakes_user_idx").on(table.userId),
    userPredictionSideIdx: uniqueIndex("stakes_user_prediction_side_uniq").on(
      table.userId,
      table.predictionId,
      table.side
    ),
  })
);

// ─── reputation_events ──────────────────────────────────────────────────────
export const reputationOutcome = ["win", "loss", "neutral"] as const;
export type ReputationOutcome = (typeof reputationOutcome)[number];

export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    outcome: text("outcome", { enum: reputationOutcome }).notNull(),
    deltaScore: integer("delta_score").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("reputation_events_user_idx").on(table.userId),
    predictionIdx: index("reputation_events_prediction_idx").on(
      table.predictionId
    ),
    userPredictionIdx: uniqueIndex(
      "reputation_events_user_prediction_uniq"
    ).on(table.userId, table.predictionId),
  })
);

// ─── comments ───────────────────────────────────────────────────────────────
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    authorUserId: integer("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    predictionIdx: index("comments_prediction_idx").on(table.predictionId),
    authorIdx: index("comments_author_idx").on(table.authorUserId),
    createdAtIdx: index("comments_created_at_idx").on(table.createdAt),
  })
);

// ─── votes ──────────────────────────────────────────────────────────────────
export const voteTargetType = ["prediction", "comment"] as const;
export type VoteTargetType = (typeof voteTargetType)[number];

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type", { enum: voteTargetType }).notNull(),
    targetId: integer("target_id").notNull(),
    // -1 downvote, +1 upvote
    value: integer("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userTargetUniq: uniqueIndex("votes_user_target_uniq").on(
      table.userId,
      table.targetType,
      table.targetId
    ),
    targetIdx: index("votes_target_idx").on(table.targetType, table.targetId),
    userIdx: index("votes_user_idx").on(table.userId),
  })
);

// ─── follows ───────────────────────────────────────────────────────────────
export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerUserId: integer("follower_user_id")
      .notNull()
      .references(() => users.id),
    followedUserId: integer("followed_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    followerFollowedUniq: uniqueIndex("follows_follower_followed_uniq").on(
      table.followerUserId,
      table.followedUserId
    ),
    followerIdx: index("follows_follower_idx").on(table.followerUserId),
    followedIdx: index("follows_followed_idx").on(table.followedUserId),
  })
);
