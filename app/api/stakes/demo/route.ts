import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { predictions, stakes } from "@/lib/db/schema";
import { getStakeSummary } from "@/lib/reputation";
import { eq } from "drizzle-orm";

function normalizeSide(x: unknown): "for" | "against" | null {
  return x === "for" || x === "against" ? x : null;
}

function normalizeAmount(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x));
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  if (n > 10_000) return null;
  return Math.round(n * 100) / 100;
}

function toBaseUnits(amount: number): string {
  return String(Math.round(amount * 1e18));
}

// ─── POST /api/stakes/demo ──────────────────────────────────────────────────
// Creates an immediately-confirmed stake. No external payment dependencies.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const predictionIdRaw = payload?.prediction_id;
  const predictionId = typeof predictionIdRaw === "number" ? predictionIdRaw : parseInt(String(predictionIdRaw), 10);
  if (!Number.isFinite(predictionId) || predictionId <= 0) {
    return Response.json({ error: "Invalid prediction_id" }, { status: 400 });
  }

  const side = normalizeSide(payload?.side);
  if (!side) {
    return Response.json({ error: "Invalid side" }, { status: 400 });
  }

  const amount = normalizeAmount(payload?.amount);
  if (!amount) {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }

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
      return Response.json({ error: "Prediction is not open for staking" }, { status: 400 });
    }

    if (pred.timeframeEnd < new Date()) {
      return Response.json({ error: "Prediction timeframe has expired" }, { status: 400 });
    }

    const inserted = await db
      .insert(stakes)
      .values({
        predictionId,
        userId: auth.user.id,
        side,
        amount: toBaseUnits(amount),
        currency: "DEMO",
        network: "demo",
        invoiceId: null,
        paymentStatus: "completed",
      })
      .returning();

    const stake = inserted[0];
    const summary = await getStakeSummary(predictionId);

    return Response.json(
      {
        stake: {
          id: stake.id,
          userId: stake.userId,
          side: stake.side,
          amountBaseUnits: stake.amount,
          currency: stake.currency,
          createdAt: stake.createdAt.toISOString(),
        },
        stakeSummary: {
          totalFor: summary.totalFor,
          totalAgainst: summary.totalAgainst,
          stakeCount: summary.stakeCount,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create demo stake:", err);
    return Response.json({ error: "Failed to create demo stake" }, { status: 500 });
  }
}

