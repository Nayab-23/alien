import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, votes } from "@/lib/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

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
  const authorUserId = parseUserId(userId);
  if (!authorUserId) {
    return Response.json({ error: "Invalid userId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

  try {
    const maybeUser = await authenticate();

    const rows = await db
      .select({
        id: comments.id,
        predictionId: comments.predictionId,
        authorUserId: comments.authorUserId,
        body: comments.body,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.authorUserId, authorUserId))
      .orderBy(desc(comments.createdAt))
      .limit(limit);

    const ids = rows.map((r) => r.id);
    const scoresById = new Map<number, number>();
    const myVotesById = new Map<number, number>();

    if (ids.length > 0) {
      const scoreRows = await db
        .select({
          targetId: votes.targetId,
          score: sql<number>`coalesce(sum(${votes.value}), 0)`,
        })
        .from(votes)
        .where(and(eq(votes.targetType, "comment"), inArray(votes.targetId, ids)))
        .groupBy(votes.targetId);
      for (const r of scoreRows) scoresById.set(Number(r.targetId), Number(r.score));

      if (maybeUser) {
        const myRows = await db
          .select({ targetId: votes.targetId, value: votes.value })
          .from(votes)
          .where(
            and(
              eq(votes.targetType, "comment"),
              inArray(votes.targetId, ids),
              eq(votes.userId, maybeUser.id)
            )
          );
        for (const r of myRows) myVotesById.set(Number(r.targetId), Number(r.value));
      }
    }

    return Response.json({
      comments: rows.map((c) => ({
        id: c.id,
        predictionId: c.predictionId,
        authorUserId: c.authorUserId,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        score: scoresById.get(c.id) ?? 0,
        userVote: myVotesById.get(c.id) ?? 0,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch user comments:", err);
    return Response.json({ error: "Failed to fetch user comments" }, { status: 500 });
  }
}

