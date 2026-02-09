import { authenticate, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { follows, predictions, votes } from "@/lib/db/schema";
import {
  validatePredictionInput,
  ValidationError,
} from "@/lib/validation";
import {
  calculateUserReputation,
  getStakeSummary,
} from "@/lib/reputation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { comments } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

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
    const maybeUser = await authenticate();
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

    const creatorIds = rows.map((r) => r.creatorUserId);
    const followingSet = new Set<number>();
    if (maybeUser && creatorIds.length > 0) {
      const followRows = await db
        .select({ followedUserId: follows.followedUserId })
        .from(follows)
        .where(
          and(
            eq(follows.followerUserId, maybeUser.id),
            inArray(follows.followedUserId, creatorIds)
          )
        );
      for (const fr of followRows) followingSet.add(fr.followedUserId);
    }

    const results = await Promise.all(
      rows.map(async (p) => {
        const creatorRep = await calculateUserReputation(p.creatorUserId);
        const stakeSummary = await getStakeSummary(p.id);
        const commentCountRow = await db
          .select({ count: sql<number>`count(*)` })
          .from(comments)
          .where(eq(comments.predictionId, p.id));
        const commentsCount = Number(commentCountRow?.[0]?.count ?? 0);
        const scoreRow = await db
          .select({ score: sql<number>`coalesce(sum(${votes.value}), 0)` })
          .from(votes)
          .where(and(eq(votes.targetType, "prediction"), eq(votes.targetId, p.id)));
        const score = Number(scoreRow?.[0]?.score ?? 0);

        let userVote = 0;
        if (maybeUser) {
          const myVote = await db
            .select({ value: votes.value })
            .from(votes)
            .where(
              and(
                eq(votes.targetType, "prediction"),
                eq(votes.targetId, p.id),
                eq(votes.userId, maybeUser.id)
              )
            )
            .limit(1);
          userVote = Number(myVote?.[0]?.value ?? 0);
        }

        return {
          id: p.id,
          creatorUserId: p.creatorUserId,
          creatorIsFollowed: maybeUser ? followingSet.has(p.creatorUserId) : false,
          assetSymbol: p.assetSymbol,
          direction: p.direction,
          timeframeEnd: Math.floor(p.timeframeEnd.getTime() / 1000),
          confidence: p.confidence,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          commentsCount,
          score,
          userVote,
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
