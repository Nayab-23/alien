import { db } from "@/lib/db";
import { stakes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ─── GET /api/stakes/:id/status ─────────────────────────────────────────────

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const stakeId = parseInt(id, 10);

  if (isNaN(stakeId)) {
    return Response.json({ error: "Invalid stake ID" }, { status: 400 });
  }

  try {
    const stake = db
      .select({
        id: stakes.id,
        paymentStatus: stakes.paymentStatus,
        amount: stakes.amount,
        currency: stakes.currency,
        side: stakes.side,
        predictionId: stakes.predictionId,
        createdAt: stakes.createdAt,
      })
      .from(stakes)
      .where(eq(stakes.id, stakeId))
      .get();

    if (!stake) {
      return Response.json({ error: "Stake not found" }, { status: 404 });
    }

    return Response.json({
      stake: {
        id: stake.id,
        status: stake.paymentStatus,
        amount: stake.amount,
        currency: stake.currency,
        side: stake.side,
        predictionId: stake.predictionId,
        createdAt: stake.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Failed to fetch stake status:", err);
    return Response.json(
      { error: "Failed to fetch stake status" },
      { status: 500 }
    );
  }
}
