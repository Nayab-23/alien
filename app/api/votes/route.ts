import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { votes } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

type VoteTargetType = "prediction" | "comment";
type VoteValue = -1 | 0 | 1;

function isTargetType(x: unknown): x is VoteTargetType {
  return x === "prediction" || x === "comment";
}

function parseVoteValue(x: unknown): VoteValue | null {
  if (x === -1 || x === 0 || x === 1) return x;
  return null;
}

// ─── POST /api/votes ────────────────────────────────────────────────────────
// Body: { target_type: "prediction"|"comment", target_id: number, value: -1|0|1 }
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const targetType = payload?.target_type;
  const targetIdRaw = payload?.target_id;
  const valueRaw = payload?.value;

  if (!isTargetType(targetType)) {
    return Response.json({ error: "Invalid target_type" }, { status: 400 });
  }

  const targetId = typeof targetIdRaw === "number" ? targetIdRaw : parseInt(String(targetIdRaw), 10);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return Response.json({ error: "Invalid target_id" }, { status: 400 });
  }

  const value = parseVoteValue(valueRaw);
  if (value === null) {
    return Response.json({ error: "Invalid value" }, { status: 400 });
  }

  if (targetType === "comment" && value === -1) {
    return Response.json({ error: "Comments only support upvotes" }, { status: 400 });
  }

  try {
    if (value === 0) {
      await db
        .delete(votes)
        .where(
          and(
            eq(votes.userId, auth.user.id),
            eq(votes.targetType, targetType),
            eq(votes.targetId, targetId)
          )
        );
    } else {
      const existing = await db
        .select({ id: votes.id })
        .from(votes)
        .where(
          and(
            eq(votes.userId, auth.user.id),
            eq(votes.targetType, targetType),
            eq(votes.targetId, targetId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(votes)
          .set({ value, updatedAt: new Date() })
          .where(eq(votes.id, existing[0].id));
      } else {
        await db.insert(votes).values({
          userId: auth.user.id,
          targetType,
          targetId,
          value,
        });
      }
    }

    const scoreRow = await db
      .select({ score: sql<number>`coalesce(sum(${votes.value}), 0)` })
      .from(votes)
      .where(and(eq(votes.targetType, targetType), eq(votes.targetId, targetId)));
    const score = Number(scoreRow?.[0]?.score ?? 0);

    const myVoteRow = await db
      .select({ value: votes.value })
      .from(votes)
      .where(
        and(
          eq(votes.userId, auth.user.id),
          eq(votes.targetType, targetType),
          eq(votes.targetId, targetId)
        )
      )
      .limit(1);
    const userVote = Number(myVoteRow?.[0]?.value ?? 0);

    return Response.json({ score, userVote });
  } catch (err) {
    console.error("Failed to apply vote:", err);
    return Response.json({ error: "Failed to apply vote" }, { status: 500 });
  }
}

