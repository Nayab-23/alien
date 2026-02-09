import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { predictions, reputationEvents } from "@/lib/db/schema";
import { getStakeSummary } from "@/lib/reputation";
import { and, desc, eq, inArray } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

function parseUserId(raw: string): number | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function GET(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const creatorUserId = parseUserId(userId);
  if (!creatorUserId) {
    return Response.json({ error: "Invalid userId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

  try {
    await authenticate(); // optional, but keeps symmetry if we add user-specific fields later

    const where =
      status === "settled"
        ? and(eq(predictions.creatorUserId, creatorUserId), eq(predictions.status, "settled"))
        : status === "open"
          ? and(eq(predictions.creatorUserId, creatorUserId), eq(predictions.status, "open"))
          : status === "cancelled"
            ? and(eq(predictions.creatorUserId, creatorUserId), eq(predictions.status, "cancelled"))
            : eq(predictions.creatorUserId, creatorUserId);

    const rows = await db
      .select()
      .from(predictions)
      .where(where)
      .orderBy(desc(predictions.createdAt))
      .limit(limit);

    // For track record, attach creator outcome from reputation_events when settled.
    const predIds = rows.map((r) => r.id);
    const outcomes = new Map<number, "win" | "loss" | "neutral">();
    if (predIds.length > 0) {
      const ev = await db
        .select({
          predictionId: reputationEvents.predictionId,
          outcome: reputationEvents.outcome,
        })
        .from(reputationEvents)
        .where(
          and(
            eq(reputationEvents.userId, creatorUserId),
            inArray(reputationEvents.predictionId, predIds)
          )
        );
      for (const e of ev) outcomes.set(e.predictionId, e.outcome);
    }

    const results = await Promise.all(
      rows.map(async (p) => {
        const stakeSummary = await getStakeSummary(p.id);
        return {
          id: p.id,
          creatorUserId: p.creatorUserId,
          assetSymbol: p.assetSymbol,
          direction: p.direction,
          timeframeEnd: Math.floor(p.timeframeEnd.getTime() / 1000),
          confidence: p.confidence,
          status: p.status,
          settlementPrice: p.settlementPrice,
          settlementTimestamp: p.settlementTimestamp
            ? Math.floor(p.settlementTimestamp.getTime() / 1000)
            : null,
          createdAt: p.createdAt.toISOString(),
          stakeSummary: {
            totalFor: stakeSummary.totalFor,
            totalAgainst: stakeSummary.totalAgainst,
            stakeCount: stakeSummary.stakeCount,
          },
          outcome: outcomes.get(p.id) ?? null,
        };
      })
    );

    return Response.json({ predictions: results });
  } catch (err) {
    console.error("Failed to fetch user predictions:", err);
    return Response.json({ error: "Failed to fetch user predictions" }, { status: 500 });
  }
}
