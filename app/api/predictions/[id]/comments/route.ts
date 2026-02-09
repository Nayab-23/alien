import { authenticate, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, votes } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeBody(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length < 1) return null;
  if (trimmed.length > 500) return null;
  return trimmed;
}

// ─── GET /api/predictions/:id/comments ──────────────────────────────────────
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const predictionId = parseInt(id, 10);
  if (isNaN(predictionId)) {
    return Response.json({ error: "Invalid prediction ID" }, { status: 400 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;
  const sort = url.searchParams.get("sort") || "new";

  try {
    const maybeUser = await authenticate();
    const base = db
      .select({
        id: comments.id,
        predictionId: comments.predictionId,
        authorUserId: comments.authorUserId,
        body: comments.body,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.predictionId, predictionId))
      .limit(limit);

    const rows =
      sort === "top"
        ? await base.orderBy(desc(comments.createdAt))
        : await base.orderBy(desc(comments.createdAt));

    const commentIds = rows.map((r) => r.id);
    const scoresById = new Map<number, number>();
    const myVotesById = new Map<number, number>();

    if (commentIds.length > 0) {
      const scoreRows = await db
        .select({
          targetId: votes.targetId,
          score: sql<number>`coalesce(sum(${votes.value}), 0)`,
        })
        .from(votes)
        .where(
          and(eq(votes.targetType, "comment"), inArray(votes.targetId, commentIds))
        )
        .groupBy(votes.targetId);

      for (const r of scoreRows) scoresById.set(Number(r.targetId), Number(r.score));

      if (maybeUser) {
        const myRows = await db
          .select({
            targetId: votes.targetId,
            value: votes.value,
          })
          .from(votes)
          .where(
            and(
              eq(votes.targetType, "comment"),
              inArray(votes.targetId, commentIds),
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
    console.error("Failed to fetch comments:", err);
    return Response.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// ─── POST /api/predictions/:id/comments ─────────────────────────────────────
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const predictionId = parseInt(id, 10);
  if (isNaN(predictionId)) {
    return Response.json({ error: "Invalid prediction ID" }, { status: 400 });
  }

  let bodyText: string | null = null;
  try {
    const body = await request.json();
    bodyText = normalizeBody(body?.body);
  } catch {
    bodyText = null;
  }

  if (!bodyText) {
    return Response.json(
      { error: "Comment body must be 1-500 characters" },
      { status: 400 }
    );
  }

  try {
    const inserted = await db
      .insert(comments)
      .values({
        predictionId,
        authorUserId: auth.user.id,
        body: bodyText,
      })
      .returning();

    const row = inserted[0];
    return Response.json(
      {
        comment: {
          id: row.id,
          predictionId: row.predictionId,
          authorUserId: row.authorUserId,
          body: row.body,
          createdAt: row.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create comment:", err);
    return Response.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
