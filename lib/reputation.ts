import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  predictions,
  stakes,
  reputationEvents,
  users,
  type PredictionStatus,
} from "@/lib/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserReputation = {
  userId: number;
  alienSubject: string;
  totalPredictions: number;
  settledPredictions: number;
  wins: number;
  losses: number;
  winRate: number; // 0-100
  reputationScore: number;
};

export type PredictionWithReputation = {
  id: number;
  creatorUserId: number;
  assetSymbol: string;
  direction: string;
  timeframeEnd: Date;
  confidence: number;
  status: PredictionStatus;
  settlementPrice: string | null;
  settlementTimestamp: Date | null;
  createdAt: Date;
  creatorReputation: {
    winRate: number;
    totalSettled: number;
    score: number;
  };
  stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  };
};

// ─── Reputation Calculation ─────────────────────────────────────────────────

/**
 * Calculate reputation for a single user.
 * Simple MVP metric: weighted by confidence and recency.
 */
export function calculateUserReputation(userId: number): UserReputation {
  // Get user info
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    throw new Error("User not found");
  }

  // Count predictions
  const totalPredictions = db
    .select({ count: sql<number>`count(*)` })
    .from(predictions)
    .where(eq(predictions.creatorUserId, userId))
    .get()?.count ?? 0;

  // Get reputation events (only exist for settled predictions)
  const events = db
    .select({
      outcome: reputationEvents.outcome,
      deltaScore: reputationEvents.deltaScore,
    })
    .from(reputationEvents)
    .where(eq(reputationEvents.userId, userId))
    .all();

  const wins = events.filter((e) => e.outcome === "win").length;
  const losses = events.filter((e) => e.outcome === "loss").length;
  const settledPredictions = events.length;
  const reputationScore = events.reduce((sum, e) => sum + e.deltaScore, 0);

  const winRate =
    settledPredictions > 0 ? (wins / settledPredictions) * 100 : 0;

  return {
    userId,
    alienSubject: user.alienSubject,
    totalPredictions,
    settledPredictions,
    wins,
    losses,
    winRate: Math.round(winRate * 10) / 10,
    reputationScore,
  };
}

/**
 * Get leaderboard — top users by reputation score.
 */
export function getLeaderboard(limit: number = 20): UserReputation[] {
  // Aggregate reputation events per user
  const userScores = db
    .select({
      userId: reputationEvents.userId,
      totalScore: sql<number>`sum(${reputationEvents.deltaScore})`,
      wins: sql<number>`sum(case when ${reputationEvents.outcome} = 'win' then 1 else 0 end)`,
      losses: sql<number>`sum(case when ${reputationEvents.outcome} = 'loss' then 1 else 0 end)`,
      settled: sql<number>`count(*)`,
    })
    .from(reputationEvents)
    .groupBy(reputationEvents.userId)
    .orderBy(sql`sum(${reputationEvents.deltaScore}) desc`)
    .limit(limit)
    .all();

  // Hydrate with user info + total predictions
  return userScores.map((row) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .get();

    const totalPredictions = db
      .select({ count: sql<number>`count(*)` })
      .from(predictions)
      .where(eq(predictions.creatorUserId, row.userId))
      .get()?.count ?? 0;

    const winRate = row.settled > 0 ? (row.wins / row.settled) * 100 : 0;

    return {
      userId: row.userId,
      alienSubject: user?.alienSubject ?? "unknown",
      totalPredictions,
      settledPredictions: row.settled,
      wins: row.wins,
      losses: row.losses,
      winRate: Math.round(winRate * 10) / 10,
      reputationScore: row.totalScore,
    };
  });
}

// ─── Stake Aggregation ──────────────────────────────────────────────────────

export type StakeSummary = {
  totalFor: string;
  totalAgainst: string;
  stakeCount: number;
};

/**
 * Aggregate stakes for a prediction (only confirmed payments).
 */
export function getStakeSummary(predictionId: number): StakeSummary {
  const stakes_ = db
    .select({
      side: stakes.side,
      amount: stakes.amount,
    })
    .from(stakes)
    .where(
      and(
        eq(stakes.predictionId, predictionId),
        eq(stakes.paymentStatus, "confirmed")
      )
    )
    .all();

  let totalFor = 0n;
  let totalAgainst = 0n;

  for (const stake of stakes_) {
    const amount = BigInt(stake.amount);
    if (stake.side === "for") {
      totalFor += amount;
    } else {
      totalAgainst += amount;
    }
  }

  return {
    totalFor: totalFor.toString(),
    totalAgainst: totalAgainst.toString(),
    stakeCount: stakes_.length,
  };
}
