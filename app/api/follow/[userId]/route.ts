import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { follows } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

function parseUserId(raw: string): number | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function followerCount(userId: number): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followedUserId, userId));
  return Number(row?.[0]?.count ?? 0);
}

// ─── POST /api/follow/:userId ───────────────────────────────────────────────
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { userId } = await context.params;
  const followedUserId = parseUserId(userId);
  if (!followedUserId) {
    return Response.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (followedUserId === auth.user.id) {
    return Response.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  try {
    const existing = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.followerUserId, auth.user.id),
          eq(follows.followedUserId, followedUserId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(follows).values({
        followerUserId: auth.user.id,
        followedUserId,
      });
    }

    return Response.json({
      following: true,
      followerCount: await followerCount(followedUserId),
    });
  } catch (err) {
    console.error("Failed to follow:", err);
    return Response.json({ error: "Failed to follow" }, { status: 500 });
  }
}

// ─── DELETE /api/follow/:userId ─────────────────────────────────────────────
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { userId } = await context.params;
  const followedUserId = parseUserId(userId);
  if (!followedUserId) {
    return Response.json({ error: "Invalid userId" }, { status: 400 });
  }

  try {
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerUserId, auth.user.id),
          eq(follows.followedUserId, followedUserId)
        )
      );

    return Response.json({
      following: false,
      followerCount: await followerCount(followedUserId),
    });
  } catch (err) {
    console.error("Failed to unfollow:", err);
    return Response.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}

