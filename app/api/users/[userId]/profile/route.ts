import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { follows, users } from "@/lib/db/schema";
import { calculateUserReputation } from "@/lib/reputation";
import { and, eq, sql } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

function parseUserId(raw: string): number | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const profileUserId = parseUserId(userId);
  if (!profileUserId) {
    return Response.json({ error: "Invalid userId" }, { status: 400 });
  }

  try {
    const maybeUser = await authenticate();

    const userRows = await db
      .select({ id: users.id, alienId: users.alienId })
      .from(users)
      .where(eq(users.id, profileUserId))
      .limit(1);

    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const rep = await calculateUserReputation(profileUserId);

    const followerRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followedUserId, profileUserId));
    const followerCount = Number(followerRow?.[0]?.count ?? 0);

    const followingRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerUserId, profileUserId));
    const followingCount = Number(followingRow?.[0]?.count ?? 0);

    let isFollowing = false;
    if (maybeUser && maybeUser.id !== profileUserId) {
      const row = await db
        .select({ id: follows.id })
        .from(follows)
        .where(
          and(
            eq(follows.followerUserId, maybeUser.id),
            eq(follows.followedUserId, profileUserId)
          )
        )
        .limit(1);
      isFollowing = row.length > 0;
    }

    return Response.json({
      user: {
        id: userRows[0].id,
        alienId: userRows[0].alienId,
        displayName: `@signal${userRows[0].id}`,
      },
      followerCount,
      followingCount,
      isFollowing,
      stats: {
        winRate: rep.winRate,
        settledPredictions: rep.settledPredictions,
        reputationScore: rep.reputationScore,
        totalPredictions: rep.totalPredictions,
        wins: rep.wins,
        losses: rep.losses,
      },
    });
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
    return Response.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}

