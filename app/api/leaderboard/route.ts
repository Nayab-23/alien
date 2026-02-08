import { getLeaderboard } from "@/lib/reputation";

// ─── GET /api/leaderboard ───────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.min(parseInt(limitParam, 10), 100)
    : 20;

  try {
    const leaderboard = getLeaderboard(limit);

    return Response.json({
      leaderboard: leaderboard.map((user, idx) => ({
        rank: idx + 1,
        userId: user.userId,
        alienSubject: user.alienSubject,
        reputationScore: user.reputationScore,
        winRate: user.winRate,
        totalPredictions: user.totalPredictions,
        settledPredictions: user.settledPredictions,
        wins: user.wins,
        losses: user.losses,
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
