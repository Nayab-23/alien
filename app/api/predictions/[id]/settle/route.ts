import { requireAuth } from "@/lib/auth";
import { settlePrediction, isAdmin } from "@/lib/settlement";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ─── POST /api/predictions/:id/settle ───────────────────────────────────────

export async function POST(_request: Request, context: RouteContext) {
  // 1. Auth required
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // 2. Admin check
  if (!isAdmin(auth.user.alienSubject)) {
    return Response.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const predictionId = parseInt(id, 10);

  if (isNaN(predictionId)) {
    return Response.json(
      { error: "Invalid prediction ID" },
      { status: 400 }
    );
  }

  try {
    const result = await settlePrediction(predictionId);

    return Response.json({
      status: "settled",
      result: {
        predictionId: result.predictionId,
        settlementPrice: result.settlementPrice,
        outcome: result.outcome,
        winnersCount: result.winners.length,
        losersCount: result.losers.length,
        creatorReputationDelta: result.creatorReputationDelta,
        winners: result.winners.map((w) => ({
          userId: w.userId,
          alienSubject: w.alienSubject,
          side: w.side,
          stakeAmount: w.stakeAmount,
          currency: w.currency,
          payout: w.payout,
          reputationDelta: w.reputationDelta,
        })),
        losers: result.losers.map((l) => ({
          userId: l.userId,
          alienSubject: l.alienSubject,
          side: l.side,
          stakeAmount: l.stakeAmount,
          currency: l.currency,
          reputationDelta: l.reputationDelta,
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Settlement failed";
    console.error(`[Settlement] Error settling prediction ${predictionId}:`, err);
    return Response.json({ error: message }, { status: 500 });
  }
}
