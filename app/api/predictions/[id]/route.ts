import { db } from "@/lib/db";
import { predictions, stakes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateUserReputation,
  getStakeSummary,
} from "@/lib/reputation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ─── GET /api/predictions/:id ───────────────────────────────────────────────

export async function GET(
  _request: Request,
  context: RouteContext
) {
  const { id } = await context.params;
  const predictionId = parseInt(id, 10);

  if (isNaN(predictionId)) {
    return Response.json(
      { error: "Invalid prediction ID" },
      { status: 400 }
    );
  }

  try {
    // Fetch prediction
    const prediction = db
      .select()
      .from(predictions)
      .where(eq(predictions.id, predictionId))
      .get();

    if (!prediction) {
      return Response.json(
        { error: "Prediction not found" },
        { status: 404 }
      );
    }

    // Creator reputation
    const creatorRep = calculateUserReputation(prediction.creatorUserId);

    // Stake summary
    const stakeSummary = getStakeSummary(predictionId);

    // Fetch individual confirmed stakes (for detail view)
    const stakesList = db
      .select({
        id: stakes.id,
        userId: stakes.userId,
        side: stakes.side,
        amount: stakes.amount,
        currency: stakes.currency,
        createdAt: stakes.createdAt,
      })
      .from(stakes)
      .where(
        and(
          eq(stakes.predictionId, predictionId),
          eq(stakes.paymentStatus, "confirmed")
        )
      )
      .all();

    return Response.json({
      prediction: {
        id: prediction.id,
        creatorUserId: prediction.creatorUserId,
        assetSymbol: prediction.assetSymbol,
        direction: prediction.direction,
        timeframeEnd: Math.floor(prediction.timeframeEnd.getTime() / 1000),
        confidence: prediction.confidence,
        status: prediction.status,
        settlementPrice: prediction.settlementPrice,
        settlementTimestamp: prediction.settlementTimestamp
          ? Math.floor(prediction.settlementTimestamp.getTime() / 1000)
          : null,
        createdAt: prediction.createdAt.toISOString(),
        creatorReputation: {
          winRate: creatorRep.winRate,
          totalSettled: creatorRep.settledPredictions,
          score: creatorRep.reputationScore,
        },
        stakeSummary: {
          totalFor: stakeSummary.totalFor,
          totalAgainst: stakeSummary.totalAgainst,
          stakeCount: stakeSummary.stakeCount,
        },
        stakes: stakesList.map((s) => ({
          id: s.id,
          userId: s.userId,
          side: s.side,
          amount: s.amount,
          currency: s.currency,
          createdAt: s.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Failed to fetch prediction:", err);
    return Response.json(
      { error: "Failed to fetch prediction" },
      { status: 500 }
    );
  }
}
