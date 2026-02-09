import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { predictions, reputationEvents, stakes, users } from "@/lib/db/schema";
import { isAdmin } from "@/lib/settlement";
import { and, eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function judgeModeEnabled(): boolean {
  return process.env.JUDGE_MODE === "true";
}

function randPrice(asset: string): string {
  const ranges: Record<string, [number, number]> = {
    BTC: [20000, 120000],
    ETH: [800, 9000],
    SOL: [10, 600],
    WLD: [0.5, 20],
  };
  const [min, max] = ranges[asset] ?? [1, 1000];
  const n = Math.random() * (max - min) + min;
  return n.toFixed(asset === "BTC" ? 0 : 2);
}

// ─── POST /api/dev/predictions/:id/settle-now ───────────────────────────────
// Dev-only: settles immediately without hitting external price oracles.
// Admin + JUDGE_MODE required.
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!judgeModeEnabled()) {
    return Response.json({ error: "Judge mode disabled" }, { status: 404 });
  }
  if (!isAdmin(auth.user.alienId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const predictionId = parseInt(id, 10);
  if (!Number.isFinite(predictionId) || predictionId <= 0) {
    return Response.json({ error: "Invalid prediction ID" }, { status: 400 });
  }

  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const outcome =
    payload?.outcome === "creator_correct" || payload?.outcome === "creator_wrong"
      ? payload.outcome
      : (Math.random() > 0.5 ? "creator_correct" : "creator_wrong");
  const creatorWasCorrect = outcome === "creator_correct";

  try {
    const predRows = await db
      .select()
      .from(predictions)
      .where(eq(predictions.id, predictionId))
      .limit(1);
    if (predRows.length === 0) {
      return Response.json({ error: "Prediction not found" }, { status: 404 });
    }
    const pred = predRows[0];

    if (pred.status !== "open") {
      return Response.json(
        { error: `Prediction is ${pred.status}, cannot settle` },
        { status: 400 }
      );
    }

    const allStakes = await db
      .select()
      .from(stakes)
      .where(and(eq(stakes.predictionId, predictionId), eq(stakes.paymentStatus, "completed")));

    if (allStakes.length === 0) {
      return Response.json({ error: "No completed stakes to settle" }, { status: 400 });
    }

    const winningSide: "for" | "against" = creatorWasCorrect ? "for" : "against";
    const losingSide: "for" | "against" = creatorWasCorrect ? "against" : "for";

    const winningStakes = allStakes.filter((s) => s.side === winningSide);
    const losingStakes = allStakes.filter((s) => s.side === losingSide);

    // Update prediction status
    await db
      .update(predictions)
      .set({
        status: "settled",
        settlementPrice: randPrice(pred.assetSymbol),
        settlementTimestamp: new Date(),
      })
      .where(eq(predictions.id, predictionId));

    // Creator reputation
    const creatorDelta = creatorWasCorrect ? pred.confidence : -pred.confidence;
    await db
      .insert(reputationEvents)
      .values({
        userId: pred.creatorUserId,
        predictionId,
        outcome: creatorWasCorrect ? "win" : "loss",
        deltaScore: creatorDelta,
      })
      .onConflictDoNothing();

    // Staker reputation events (mirror settlement.ts behavior)
    for (const s of winningStakes) {
      await db
        .insert(reputationEvents)
        .values({
          userId: s.userId,
          predictionId,
          outcome: "win",
          deltaScore: pred.confidence,
        })
        .onConflictDoNothing();
    }
    for (const s of losingStakes) {
      await db
        .insert(reputationEvents)
        .values({
          userId: s.userId,
          predictionId,
          outcome: "loss",
          deltaScore: -pred.confidence,
        })
        .onConflictDoNothing();
    }

    // Return some summary so UI can toast.
    const creator = await db
      .select({ id: users.id, alienId: users.alienId })
      .from(users)
      .where(eq(users.id, pred.creatorUserId))
      .limit(1);

    return Response.json({
      ok: true,
      predictionId,
      outcome,
      creator: creator[0] ?? null,
      winners: winningStakes.length,
      losers: losingStakes.length,
      creatorReputationDelta: creatorDelta,
    });
  } catch (err) {
    console.error("Dev settle failed:", err);
    return Response.json({ error: "Dev settle failed" }, { status: 500 });
  }
}

