import { db } from "@/lib/db";
import {
  predictions,
  stakes,
  reputationEvents,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createPriceProvider } from "@/lib/price-oracle";
import { fromBaseUnits } from "@/lib/payments";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SettlementResult = {
  predictionId: number;
  settlementPrice: string;
  outcome: "creator_correct" | "creator_wrong";
  winners: {
    userId: number;
    alienId: string;
    side: "for" | "against";
    stakeAmount: string;
    currency: string;
    payout: string;
    reputationDelta: number;
  }[];
  losers: {
    userId: number;
    alienId: string;
    side: "for" | "against";
    stakeAmount: string;
    currency: string;
    reputationDelta: number;
  }[];
  creatorReputationDelta: number;
};

// ─── Settlement Logic ───────────────────────────────────────────────────────

export async function settlePrediction(
  predictionId: number
): Promise<SettlementResult> {
  // 1. Get prediction
  const predictionRows = await db
    .select()
    .from(predictions)
    .where(eq(predictions.id, predictionId))
    .limit(1);

  if (predictionRows.length === 0) {
    throw new Error("Prediction not found");
  }

  const prediction = predictionRows[0];

  if (prediction.status !== "open") {
    throw new Error(`Prediction is ${prediction.status}, cannot settle`);
  }

  // 2. Fetch price at timeframe_end
  const priceProvider = createPriceProvider();
  const settlementPrice = await priceProvider.getPriceAt(
    prediction.assetSymbol,
    prediction.timeframeEnd
  );

  if (settlementPrice === null) {
    throw new Error(
      `Failed to fetch price for ${prediction.assetSymbol} at ${prediction.timeframeEnd.toISOString()}`
    );
  }

  // 3. Determine if prediction was correct
  const creationPrice = await priceProvider.getPriceAt(
    prediction.assetSymbol,
    prediction.createdAt
  );

  if (creationPrice === null) {
    throw new Error(
      `Failed to fetch creation price for ${prediction.assetSymbol}`
    );
  }

  const priceWentUp = settlementPrice > creationPrice;
  const creatorWasCorrect =
    (prediction.direction === "up" && priceWentUp) ||
    (prediction.direction === "down" && !priceWentUp);

  const outcome: "creator_correct" | "creator_wrong" = creatorWasCorrect
    ? "creator_correct"
    : "creator_wrong";

  // 4. Get all completed stakes
  const allStakes = await db
    .select()
    .from(stakes)
    .where(
      and(
        eq(stakes.predictionId, predictionId),
        eq(stakes.paymentStatus, "completed")
      )
    );

  if (allStakes.length === 0) {
    throw new Error("No completed stakes to settle");
  }

  // 5. Separate winners and losers
  const winningSide: "for" | "against" = creatorWasCorrect ? "for" : "against";
  const losingSide: "for" | "against" = creatorWasCorrect ? "against" : "for";

  const winningStakes = allStakes.filter((s) => s.side === winningSide);
  const losingStakes = allStakes.filter((s) => s.side === losingSide);

  // 6. Calculate payouts for winners (proportional to stake)
  const winners = [];
  for (const stake of winningStakes) {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, stake.userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new Error(`User ${stake.userId} not found`);
    }

    const user = userRows[0];

    const totalWinningPool = winningStakes
      .filter((s) => s.currency === stake.currency)
      .reduce((sum, s) => sum + BigInt(s.amount), 0n);

    const totalLosingPool = losingStakes
      .filter((s) => s.currency === stake.currency)
      .reduce((sum, s) => sum + BigInt(s.amount), 0n);

    const stakeAmount = BigInt(stake.amount);
    let payout = stakeAmount;

    if (totalWinningPool > 0n) {
      payout += (stakeAmount * totalLosingPool) / totalWinningPool;
    }

    const reputationDelta = prediction.confidence;

    winners.push({
      userId: stake.userId,
      alienId: user.alienId,
      side: stake.side as "for" | "against",
      stakeAmount: fromBaseUnits(stake.amount, stake.currency as "WLD" | "USDC"),
      currency: stake.currency,
      payout: fromBaseUnits(payout.toString(), stake.currency as "WLD" | "USDC"),
      reputationDelta,
    });
  }

  // 7. Calculate reputation for losers
  const losers = [];
  for (const stake of losingStakes) {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, stake.userId))
      .limit(1);

    if (userRows.length === 0) {
      throw new Error(`User ${stake.userId} not found`);
    }

    const user = userRows[0];
    const reputationDelta = -prediction.confidence;

    losers.push({
      userId: stake.userId,
      alienId: user.alienId,
      side: stake.side as "for" | "against",
      stakeAmount: fromBaseUnits(stake.amount, stake.currency as "WLD" | "USDC"),
      currency: stake.currency,
      reputationDelta,
    });
  }

  // 8. Creator reputation
  const creatorReputationDelta = creatorWasCorrect
    ? prediction.confidence
    : -prediction.confidence;

  // 9. Update database
  await db
    .update(predictions)
    .set({
      status: "settled",
      settlementPrice: settlementPrice.toString(),
      settlementTimestamp: new Date(),
    })
    .where(eq(predictions.id, predictionId));

  // Create reputation event for creator
  await db.insert(reputationEvents).values({
    userId: prediction.creatorUserId,
    predictionId,
    outcome: creatorWasCorrect ? "win" : "loss",
    deltaScore: creatorReputationDelta,
  });

  // Create reputation events for all stakers
  for (const winner of winners) {
    await db
      .insert(reputationEvents)
      .values({
        userId: winner.userId,
        predictionId,
        outcome: "win",
        deltaScore: winner.reputationDelta,
      })
      .onConflictDoNothing();
  }

  for (const loser of losers) {
    await db
      .insert(reputationEvents)
      .values({
        userId: loser.userId,
        predictionId,
        outcome: "loss",
        deltaScore: loser.reputationDelta,
      })
      .onConflictDoNothing();
  }

  console.log(
    `[Settlement] Prediction ${predictionId} settled:`,
    `price=${settlementPrice}, outcome=${outcome}, winners=${winners.length}, losers=${losers.length}`
  );

  return {
    predictionId,
    settlementPrice: settlementPrice.toString(),
    outcome,
    winners,
    losers,
    creatorReputationDelta,
  };
}

// ─── Admin Check ────────────────────────────────────────────────────────────

export function isAdmin(alienId: string): boolean {
  const adminList = process.env.ADMIN_ALIEN_IDS || "";
  const admins = adminList
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(alienId.toLowerCase());
}
