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
  type PredictionWithReputation,
} from "@/lib/reputation";
import { desc, eq } from "drizzle-orm";

// ─── POST /api/predictions ──────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth required
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // 2. Validate input
  let input;
  try {
    const body = await request.json();
    input = validatePredictionInput(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 3. Insert prediction
  try {
    const result = db
      .insert(predictions)
      .values({
        creatorUserId: auth.user.id,
        assetSymbol: input.assetSymbol,
        direction: input.direction,
        timeframeEnd: new Date(input.timeframeEnd * 1000),
        confidence: input.confidence,
        status: "open",
      })
      .returning()
      .get();

    return Response.json(
      {
        prediction: {
          id: result.id,
          assetSymbol: result.assetSymbol,
          direction: result.direction,
          timeframeEnd: Math.floor(result.timeframeEnd.getTime() / 1000),
          confidence: result.confidence,
          status: result.status,
          createdAt: result.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create prediction:", err);
    return Response.json(
      { error: "Failed to create prediction" },
      { status: 500 }
    );
  }
}

// ─── GET /api/predictions ───────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;
  const status = url.searchParams.get("status"); // optional filter: open, settled, cancelled

  try {
    // Base query
    const query = db
      .select()
      .from(predictions)
      .orderBy(desc(predictions.createdAt))
      .limit(limit);

    // Optional status filter
    let rows;
    if (status === "open" || status === "settled" || status === "cancelled") {
      rows = query.where(eq(predictions.status, status)).all();
    } else {
      rows = query.all();
    }

    // Hydrate with reputation + stake summary
    const results: PredictionWithReputation[] = rows.map((p) => {
      const creatorRep = calculateUserReputation(p.creatorUserId);
      const stakeSummary = getStakeSummary(p.id);

      return {
        id: p.id,
        creatorUserId: p.creatorUserId,
        assetSymbol: p.assetSymbol,
        direction: p.direction,
        timeframeEnd: p.timeframeEnd,
        confidence: p.confidence,
        status: p.status,
        settlementPrice: p.settlementPrice,
        settlementTimestamp: p.settlementTimestamp,
        createdAt: p.createdAt,
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
    });

    return Response.json({
      predictions: results.map((p) => ({
        id: p.id,
        assetSymbol: p.assetSymbol,
        direction: p.direction,
        timeframeEnd: Math.floor(p.timeframeEnd.getTime() / 1000),
        confidence: p.confidence,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        creatorReputation: p.creatorReputation,
        stakeSummary: p.stakeSummary,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch predictions:", err);
    return Response.json(
      { error: "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}
