import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── users ──────────────────────────────────────────────────────────────────
// Anchored to Alien (World ID) verified identity via alien_subject.
// alien_subject is the nullifier hash — unique per human, survives wallet changes.
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    alienSubject: text("alien_subject").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    alienSubjectIdx: uniqueIndex("users_alien_subject_uniq").on(
      table.alienSubject
    ),
  })
);

// ─── predictions ────────────────────────────────────────────────────────────
export const predictionStatus = ["open", "settled", "cancelled"] as const;
export type PredictionStatus = (typeof predictionStatus)[number];

export const predictionDirection = ["up", "down"] as const;
export type PredictionDirection = (typeof predictionDirection)[number];

export const predictions = sqliteTable(
  "predictions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    creatorUserId: integer("creator_user_id")
      .notNull()
      .references(() => users.id),
    assetSymbol: text("asset_symbol").notNull(), // e.g. "ETH", "BTC", "WLD"
    direction: text("direction", { enum: predictionDirection }).notNull(),
    timeframeEnd: integer("timeframe_end", { mode: "timestamp" }).notNull(),
    confidence: integer("confidence").notNull(), // 1-100
    status: text("status", { enum: predictionStatus })
      .notNull()
      .default("open"),
    settlementPrice: text("settlement_price"), // string to avoid float precision loss
    settlementTimestamp: integer("settlement_timestamp", {
      mode: "timestamp",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
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

export const paymentStatus = ["initiated", "confirmed", "failed"] as const;
export type PaymentStatus = (typeof paymentStatus)[number];

export const stakes = sqliteTable(
  "stakes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    side: text("side", { enum: stakeSide }).notNull(),
    amount: text("amount").notNull(), // smallest token units as string
    currency: text("currency").notNull(), // e.g. "WLD", "USDC"
    invoiceId: text("invoice_id"),
    paymentStatus: text("payment_status", { enum: paymentStatus })
      .notNull()
      .default("initiated"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    invoiceIdIdx: uniqueIndex("stakes_invoice_id_uniq").on(table.invoiceId),
    predictionIdx: index("stakes_prediction_idx").on(table.predictionId),
    userIdx: index("stakes_user_idx").on(table.userId),
    // Prevent same user staking the same side on the same prediction twice
    userPredictionSideIdx: uniqueIndex("stakes_user_prediction_side_uniq").on(
      table.userId,
      table.predictionId,
      table.side
    ),
  })
);

// ─── reputation_events ──────────────────────────────────────────────────────
// Immutable audit log. One row per user per settled prediction.
export const reputationOutcome = ["win", "loss", "neutral"] as const;
export type ReputationOutcome = (typeof reputationOutcome)[number];

export const reputationEvents = sqliteTable(
  "reputation_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    outcome: text("outcome", { enum: reputationOutcome }).notNull(),
    deltaScore: integer("delta_score").notNull(), // positive or negative
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdx: index("reputation_events_user_idx").on(table.userId),
    predictionIdx: index("reputation_events_prediction_idx").on(
      table.predictionId
    ),
    // One reputation event per user per prediction
    userPredictionIdx: uniqueIndex(
      "reputation_events_user_prediction_uniq"
    ).on(table.userId, table.predictionId),
  })
);
