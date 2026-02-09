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
  alienId: string;
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

export async function calculateUserReputation(userId: number): Promise<UserReputation> {
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length === 0) {
    throw new Error("User not found");
  }

  const user = userRows[0];

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(predictions)
    .where(eq(predictions.creatorUserId, userId));

  const totalPredictions = countResult[0]?.count ?? 0;

  const events = await db
    .select({
      outcome: reputationEvents.outcome,
      deltaScore: reputationEvents.deltaScore,
    })
    .from(reputationEvents)
    .where(eq(reputationEvents.userId, userId));

  const wins = events.filter((e) => e.outcome === "win").length;
  const losses = events.filter((e) => e.outcome === "loss").length;
  const settledPredictions = events.length;
  const reputationScore = events.reduce((sum, e) => sum + e.deltaScore, 0);

  const winRate =
    settledPredictions > 0 ? (wins / settledPredictions) * 100 : 0;

  return {
    userId,
    alienId: user.alienId,
    totalPredictions,
    settledPredictions,
    wins,
    losses,
    winRate: Math.round(winRate * 10) / 10,
    reputationScore,
  };
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export async function getLeaderboard(limit: number = 20): Promise<UserReputation[]> {
  const userScores = await db
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
    .limit(limit);

  const results: UserReputation[] = [];

  for (const row of userScores) {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(predictions)
      .where(eq(predictions.creatorUserId, row.userId));

    const totalPredictions = countResult[0]?.count ?? 0;
    const winRate = row.settled > 0 ? (row.wins / row.settled) * 100 : 0;

    results.push({
      userId: row.userId,
      alienId: userRows[0]?.alienId ?? "unknown",
      totalPredictions,
      settledPredictions: row.settled,
      wins: row.wins,
      losses: row.losses,
      winRate: Math.round(winRate * 10) / 10,
      reputationScore: row.totalScore,
    });
  }

  return results;
}

// ─── Stake Aggregation ──────────────────────────────────────────────────────

export type StakeSummary = {
  totalFor: string;
  totalAgainst: string;
  stakeCount: number;
};

export async function getStakeSummary(predictionId: number): Promise<StakeSummary> {
  const stakeRows = await db
    .select({
      side: stakes.side,
      amount: stakes.amount,
    })
    .from(stakes)
    .where(
      and(
        eq(stakes.predictionId, predictionId),
        eq(stakes.paymentStatus, "completed")
      )
    );

  let totalFor = 0n;
  let totalAgainst = 0n;

  for (const stake of stakeRows) {
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
    stakeCount: stakeRows.length,
  };
}
