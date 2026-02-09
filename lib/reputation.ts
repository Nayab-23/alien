import { eq, and, gte, inArray, desc, sql } from "drizzle-orm";
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
  streak?: number;
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
  return getLeaderboardFiltered(limit);
}

export async function getLeaderboardFiltered(
  limit: number = 20,
  opts?: { since?: Date; userIds?: number[] }
): Promise<UserReputation[]> {
  const where =
    opts?.since && opts?.userIds?.length
      ? and(gte(reputationEvents.createdAt, opts.since), inArray(reputationEvents.userId, opts.userIds))
      : opts?.since
        ? gte(reputationEvents.createdAt, opts.since)
        : opts?.userIds?.length
          ? inArray(reputationEvents.userId, opts.userIds)
          : undefined;

  const base = db
    .select({
      userId: reputationEvents.userId,
      totalScore: sql<number>`sum(${reputationEvents.deltaScore})`,
      wins: sql<number>`sum(case when ${reputationEvents.outcome} = 'win' then 1 else 0 end)`,
      losses: sql<number>`sum(case when ${reputationEvents.outcome} = 'loss' then 1 else 0 end)`,
      settled: sql<number>`count(*)`,
    })
    .from(reputationEvents);

  const userScores = await (where ? base.where(where) : base)
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
    const streak = await getUserStreak(row.userId, opts?.since);

    results.push({
      userId: row.userId,
      alienId: userRows[0]?.alienId ?? "unknown",
      totalPredictions,
      settledPredictions: row.settled,
      wins: row.wins,
      losses: row.losses,
      winRate: Math.round(winRate * 10) / 10,
      reputationScore: row.totalScore,
      streak,
    });
  }

  return results;
}

async function getUserStreak(userId: number, since?: Date): Promise<number> {
  const base = db
    .select({
      outcome: reputationEvents.outcome,
      createdAt: reputationEvents.createdAt,
    })
    .from(reputationEvents);

  const rows = await (since
    ? base
        .where(and(eq(reputationEvents.userId, userId), gte(reputationEvents.createdAt, since)))
        .orderBy(desc(reputationEvents.createdAt))
        .limit(20)
    : base
        .where(eq(reputationEvents.userId, userId))
        .orderBy(desc(reputationEvents.createdAt))
        .limit(20));

  let streak = 0;
  let mode: "win" | "loss" | null = null;

  for (const r of rows) {
    if (r.outcome !== "win" && r.outcome !== "loss") continue;
    if (!mode) mode = r.outcome;
    if (r.outcome !== mode) break;
    streak += mode === "win" ? 1 : -1;
  }

  return streak;
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
