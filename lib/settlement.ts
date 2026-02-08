import { db } from "@/lib/db";
import {
  predictions,
  stakes,
  reputationEvents,
  users,
  type PredictionDirection,
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
    alienSubject: string;
    side: "for" | "against";
    stakeAmount: string;
    currency: string;
    payout: string; // Calculated payout in same currency
    reputationDelta: number;
  }[];
  losers: {
    userId: number;
    alienSubject: string;
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
  const prediction = db
    .select()
    .from(predictions)
    .where(eq(predictions.id, predictionId))
    .get();

  if (!prediction) {
    throw new Error("Prediction not found");
  }

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
  // For simplicity, compare against creation time price (or use a reference price)
  // In MVP, we'll check if direction matches price movement from a reference
  // For this implementation: just use a simple heuristic or assume creator prediction
  // is evaluated against "did price go up/down from creation time"

  // Fetch creation-time price for comparison
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

  // 4. Get all confirmed stakes
  const allStakes = db
    .select()
    .from(stakes)
    .where(
      and(
        eq(stakes.predictionId, predictionId),
        eq(stakes.paymentStatus, "confirmed")
      )
    )
    .all();

  if (allStakes.length === 0) {
    throw new Error("No confirmed stakes to settle");
  }

  // 5. Separate winners and losers
  // "for" means betting creator is correct, "against" means betting creator is wrong
  const winningSide: "for" | "against" = creatorWasCorrect ? "for" : "against";
  const losingSide: "for" | "against" = creatorWasCorrect ? "against" : "for";

  const winningStakes = allStakes.filter((s) => s.side === winningSide);
  const losingStakes = allStakes.filter((s) => s.side === losingSide);

  // 6. Calculate total pool by currency
  const poolByCurrency: Record<string, bigint> = {};

  for (const stake of allStakes) {
    if (!poolByCurrency[stake.currency]) {
      poolByCurrency[stake.currency] = 0n;
    }
    poolByCurrency[stake.currency] += BigInt(stake.amount);
  }

  // 7. Calculate payouts for winners (proportional to stake)
  const winners = winningStakes.map((stake) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, stake.userId))
      .get();

    if (!user) {
      throw new Error(`User ${stake.userId} not found`);
    }

    // Winner gets their stake back + proportional share of losing side's pool
    const totalWinningPool = winningStakes
      .filter((s) => s.currency === stake.currency)
      .reduce((sum, s) => sum + BigInt(s.amount), 0n);

    const totalLosingPool = losingStakes
      .filter((s) => s.currency === stake.currency)
      .reduce((sum, s) => sum + BigInt(s.amount), 0n);

    const stakeAmount = BigInt(stake.amount);
    let payout = stakeAmount; // Get stake back

    if (totalWinningPool > 0n) {
      // Add proportional share of losing pool
      payout += (stakeAmount * totalLosingPool) / totalWinningPool;
    }

    // Reputation: +confidence for winners
    const reputationDelta = prediction.confidence;

    return {
      userId: stake.userId,
      alienSubject: user.alienSubject,
      side: stake.side,
      stakeAmount: fromBaseUnits(stake.amount, stake.currency as "WLD" | "USDC"),
      currency: stake.currency,
      payout: fromBaseUnits(payout.toString(), stake.currency as "WLD" | "USDC"),
      reputationDelta,
    };
  });

  // 8. Calculate reputation for losers
  const losers = losingStakes.map((stake) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, stake.userId))
      .get();

    if (!user) {
      throw new Error(`User ${stake.userId} not found`);
    }

    // Reputation: -confidence for losers
    const reputationDelta = -prediction.confidence;

    return {
      userId: stake.userId,
      alienSubject: user.alienSubject,
      side: stake.side,
      stakeAmount: fromBaseUnits(stake.amount, stake.currency as "WLD" | "USDC"),
      currency: stake.currency,
      reputationDelta,
    };
  });

  // 9. Creator reputation
  // Creator gets +confidence if correct, -confidence if wrong
  const creatorReputationDelta = creatorWasCorrect
    ? prediction.confidence
    : -prediction.confidence;

  // 10. Update database
  // Mark prediction as settled
  db.update(predictions)
    .set({
      status: "settled",
      settlementPrice: settlementPrice.toString(),
      settlementTimestamp: new Date(),
    })
    .where(eq(predictions.id, predictionId))
    .run();

  // Create reputation events for creator
  db.insert(reputationEvents)
    .values({
      userId: prediction.creatorUserId,
      predictionId,
      outcome: creatorWasCorrect ? "win" : "loss",
      deltaScore: creatorReputationDelta,
    })
    .run();

  // Create reputation events for all stakers
  for (const winner of winners) {
    db.insert(reputationEvents)
      .values({
        userId: winner.userId,
        predictionId,
        outcome: "win",
        deltaScore: winner.reputationDelta,
      })
      .onConflictDoNothing() // Prevent duplicates if re-settling
      .run();
  }

  for (const loser of losers) {
    db.insert(reputationEvents)
      .values({
        userId: loser.userId,
        predictionId,
        outcome: "loss",
        deltaScore: loser.reputationDelta,
      })
      .onConflictDoNothing()
      .run();
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

export function isAdmin(alienSubject: string): boolean {
  const adminList = process.env.ADMIN_ALIEN_SUBJECTS || "";
  const admins = adminList
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(alienSubject.toLowerCase());
}
