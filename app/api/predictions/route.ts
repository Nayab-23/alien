import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import {
  validatePredictionInput,
  ValidationError,
} from "@/lib/validation";
import {
  calculateUserReputation,
  getStakeSummary,
} from "@/lib/reputation";
import { desc, eq } from "drizzle-orm";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let input;
  try {
    const body = await request.json();
    input = validatePredictionInput(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await db
      .insert(predictions)
      .values({
        creatorUserId: auth.user.id,
        assetSymbol: input.assetSymbol,
        direction: input.direction,
        timeframeEnd: new Date(input.timeframeEnd * 1000),
        confidence: input.confidence,
        status: "open",
      })
      .returning();

    const row = result[0];
    return Response.json(
      {
        prediction: {
          id: row.id,
          assetSymbol: row.assetSymbol,
          direction: row.direction,
          timeframeEnd: Math.floor(row.timeframeEnd.getTime() / 1000),
          confidence: row.confidence,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create prediction:", err);
    return Response.json({ error: "Failed to create prediction" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;
  const status = url.searchParams.get("status");

  try {
    let rows;
    if (status === "open" || status === "settled" || status === "cancelled") {
      rows = await db
        .select()
        .from(predictions)
        .where(eq(predictions.status, status))
        .orderBy(desc(predictions.createdAt))
        .limit(limit);
    } else {
      rows = await db
        .select()
        .from(predictions)
        .orderBy(desc(predictions.createdAt))
        .limit(limit);
    }

    const results = await Promise.all(
      rows.map(async (p) => {
        const creatorRep = await calculateUserReputation(p.creatorUserId);
        const stakeSummary = await getStakeSummary(p.id);

        return {
          id: p.id,
          assetSymbol: p.assetSymbol,
          direction: p.direction,
          timeframeEnd: Math.floor(p.timeframeEnd.getTime() / 1000),
          confidence: p.confidence,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
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
        };
      })
    );

    return Response.json({ predictions: results });
  } catch (err) {
    console.error("Failed to fetch predictions:", err);
    return Response.json({ error: "Failed to fetch predictions" }, { status: 500 });
  }
}
