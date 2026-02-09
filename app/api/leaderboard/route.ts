import { authenticate } from "@/lib/auth";
import { getLeaderboardFiltered } from "@/lib/reputation";
import { db } from "@/lib/db";
import { follows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ─── GET /api/leaderboard ───────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.min(parseInt(limitParam, 10), 100)
    : 20;
  const period = url.searchParams.get("period") || "all"; // all|week
  const scope = url.searchParams.get("scope") || "all"; // all|following

  const since =
    period === "week" ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : undefined;

  try {
    let userIds: number[] | undefined;
    if (scope === "following") {
      const me = await authenticate();
      if (!me) {
        return Response.json(
          { error: "Missing or invalid authorization token" },
          { status: 401 }
        );
      }
      const rows = await db
        .select({ followedUserId: follows.followedUserId })
        .from(follows)
        .where(eq(follows.followerUserId, me.id));
      userIds = rows.map((r) => r.followedUserId);
      if (userIds.length === 0) {
        return Response.json({
          summary: { totalPredictors: 0, totalSettledPredictions: 0 },
          leaderboard: [],
        });
      }
    }

    const leaderboard = await getLeaderboardFiltered(limit, { since, userIds });
    const totalPredictors = leaderboard.length;
    const totalSettledPredictions = leaderboard.reduce(
      (sum, u) => sum + (u.settledPredictions ?? 0),
      0
    );

    return Response.json({
      summary: {
        totalPredictors,
        totalSettledPredictions,
        period,
        scope,
      },
      leaderboard: leaderboard.map((user, idx) => ({
        rank: idx + 1,
        userId: user.userId,
        alienId: user.alienId,
        reputationScore: user.reputationScore,
        winRate: user.winRate,
        totalPredictions: user.totalPredictions,
        settledPredictions: user.settledPredictions,
        wins: user.wins,
        losses: user.losses,
        streak: user.streak ?? 0,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    return Response.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
