import { isDemoMode } from "@/lib/demoMode";
import { getDemoState, updateDemoState } from "@/lib/data/demoStore";
import type { DemoComment, DemoPrediction } from "@/demo/demoData";

type FeedPrediction = {
  id: number;
  creatorUserId?: number;
  creatorIsFollowed?: boolean;
  assetSymbol: string;
  direction: "up" | "down";
  timeframeEnd: number;
  confidence: number;
  status: string;
  createdAt: string;
  score?: number;
  userVote?: -1 | 0 | 1;
  stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  };
  commentsCount?: number;
  creatorReputation?: {
    winRate: number;
    totalSettled: number;
    score: number;
  };
};

type PredictionDetail = FeedPrediction & {
  settlementPrice: string | null;
  settlementTimestamp: number | null;
  creatorUserId: number;
  creatorReputation: {
    winRate: number;
    totalSettled: number;
    score: number;
  };
  stakes: Array<{
    id: number;
    userId: number;
    side: "for" | "against";
    amount: string;
    currency: string;
    createdAt: string;
  }>;
  reputationEvents?: Array<{
    id: number;
    userId: number;
    outcome: "win" | "loss" | "neutral";
    deltaScore: number;
    createdAt: string;
  }>;
};

type LeaderboardEntry = {
  rank: number;
  userId: number;
  alienId: string;
  reputationScore: number;
  winRate: number;
  totalPredictions: number;
  settledPredictions: number;
  wins: number;
  losses: number;
  streak: number;
};

type LeaderboardSummary = {
  totalPredictors: number;
  totalSettledPredictions: number;
  period: string;
  scope: string;
};

type UserProfileResponse = {
  user: { id: number; alienId: string; displayName: string };
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  stats: {
    winRate: number;
    settledPredictions: number;
    reputationScore: number;
    totalPredictions: number;
    wins: number;
    losses: number;
  };
};

type UserPrediction = FeedPrediction & {
  settlementPrice?: string | null;
  settlementTimestamp?: number | null;
  outcome?: "win" | "loss" | "neutral" | null;
};

type UserComment = {
  id: number;
  predictionId: number;
  authorUserId: number;
  body: string;
  createdAt: string;
  score: number;
  userVote: 0 | 1;
};

function toBaseUnits(amount: number): string {
  return String(Math.round(Math.max(0, amount) * 1e18));
}

function nowIso(): string {
  return new Date().toISOString();
}

function computeCreatorReputation(creatorUserId: number): {
  winRate: number;
  totalSettled: number;
  score: number;
} {
  const state = getDemoState();
  const repEvents = state.predictions.flatMap((p) => p.reputationEvents ?? []);
  const my = repEvents.filter((e) => e.userId === creatorUserId);
  const wins = my.filter((e) => e.outcome === "win").length;
  const losses = my.filter((e) => e.outcome === "loss").length;
  const settled = wins + losses;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0;
  const score = my.reduce((s, e) => s + e.deltaScore, 0);
  return { winRate, totalSettled: settled, score };
}

function creatorIsFollowed(creatorUserId: number): boolean {
  const state = getDemoState();
  const followed = state.follows[state.currentUserId] ?? [];
  return followed.includes(creatorUserId);
}

async function apiJson<T>(
  path: string,
  opts?: { method?: string; body?: unknown; authToken?: string | null }
): Promise<T> {
  const res = await fetch(path, {
    method: opts?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.authToken ? { Authorization: `Bearer ${opts.authToken}` } : null),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const dataClient = {
  demoMode(): boolean {
    return isDemoMode();
  },

  async listPredictions(opts?: { limit?: number; authToken?: string | null }): Promise<FeedPrediction[]> {
    if (!isDemoMode()) {
      const limit = opts?.limit ?? 20;
      return await apiJson<{ predictions: FeedPrediction[] }>(`/api/predictions?limit=${limit}`, {
        authToken: opts?.authToken ?? null,
      }).then((d) => d.predictions || []);
    }

    const state = getDemoState();
    const limit = opts?.limit ?? 20;
    const preds = [...state.predictions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        creatorUserId: p.creatorUserId,
        creatorIsFollowed: creatorIsFollowed(p.creatorUserId),
        assetSymbol: p.assetSymbol,
        direction: p.direction,
        timeframeEnd: p.timeframeEnd,
        confidence: p.confidence,
        status: p.status,
        createdAt: p.createdAt,
        commentsCount: p.commentsCount,
        score: p.score,
        userVote: p.userVote,
        creatorReputation: computeCreatorReputation(p.creatorUserId),
        stakeSummary: p.stakeSummary,
      }));
    return preds;
  },

  async getPrediction(id: number | string, opts?: { authToken?: string | null }): Promise<PredictionDetail> {
    const predictionId = typeof id === "number" ? id : parseInt(String(id), 10);
    if (!Number.isFinite(predictionId)) throw new Error("Invalid prediction id");

    if (!isDemoMode()) {
      const data = await apiJson<{ prediction: PredictionDetail }>(`/api/predictions/${predictionId}`, {
        authToken: opts?.authToken ?? null,
      });
      return data.prediction;
    }

    const state = getDemoState();
    const pred = state.predictions.find((p) => p.id === predictionId);
    if (!pred) throw new Error("Prediction not found");
    return {
      id: pred.id,
      creatorUserId: pred.creatorUserId,
      assetSymbol: pred.assetSymbol,
      direction: pred.direction,
      timeframeEnd: pred.timeframeEnd,
      confidence: pred.confidence,
      status: pred.status,
      settlementPrice: pred.settlementPrice,
      settlementTimestamp: pred.settlementTimestamp,
      createdAt: pred.createdAt,
      commentsCount: pred.commentsCount,
      score: pred.score,
      userVote: pred.userVote,
      creatorReputation: computeCreatorReputation(pred.creatorUserId),
      stakeSummary: pred.stakeSummary,
      stakes: pred.stakes.map((s) => ({
        id: s.id,
        userId: s.userId,
        side: s.side,
        amount: s.amount,
        currency: s.currency,
        createdAt: s.createdAt,
      })),
      reputationEvents: pred.reputationEvents?.map((e) => ({
        id: e.id,
        userId: e.userId,
        outcome: e.outcome,
        deltaScore: e.deltaScore,
        createdAt: e.createdAt,
      })),
    };
  },

  async listComments(
    predictionId: number,
    opts?: { limit?: number; sort?: "top" | "new"; authToken?: string | null }
  ): Promise<DemoComment[]> {
    if (!isDemoMode()) {
      const limit = opts?.limit ?? 100;
      const sort = opts?.sort ?? "top";
      const data = await apiJson<{ comments: DemoComment[] }>(
        `/api/predictions/${predictionId}/comments?limit=${limit}&sort=${sort}`,
        { authToken: opts?.authToken ?? null }
      );
      return data.comments || [];
    }

    const state = getDemoState();
    const list = [...(state.commentsByPredictionId[predictionId] ?? [])];
    const sort = opts?.sort ?? "top";
    if (sort === "new") {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      list.sort((a, b) => (b.score - a.score) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
    return list.slice(0, opts?.limit ?? 100);
  },

  async createComment(opts: { predictionId: number; body: string; authToken?: string | null }): Promise<DemoComment> {
    if (!isDemoMode()) {
      const data = await apiJson<{ comment: DemoComment }>(`/api/predictions/${opts.predictionId}/comments`, {
        method: "POST",
        body: { body: opts.body },
        authToken: opts.authToken ?? null,
      });
      return data.comment;
    }

    let created: DemoComment | null = null;
    updateDemoState((state) => {
      const pred = state.predictions.find((p) => p.id === opts.predictionId);
      if (!pred) throw new Error("Prediction not found");
      const comment: DemoComment = {
        id: state.nextIds.comment++,
        predictionId: opts.predictionId,
        authorUserId: state.currentUserId,
        body: opts.body.trim().slice(0, 500),
        createdAt: nowIso(),
        score: 1,
        userVote: 1,
      };
      state.commentsByPredictionId[opts.predictionId] = [
        comment,
        ...(state.commentsByPredictionId[opts.predictionId] ?? []),
      ];
      pred.commentsCount = (pred.commentsCount ?? 0) + 1;
      created = comment;
    });
    if (!created) throw new Error("Failed to create comment");
    return created;
  },

  async vote(opts: {
    targetType: "prediction" | "comment";
    targetId: number;
    value: -1 | 0 | 1;
    authToken?: string | null;
  }): Promise<{ score: number; userVote: number }> {
    if (!isDemoMode()) {
      return await apiJson<{ score: number; userVote: number }>(`/api/votes`, {
        method: "POST",
        body: { target_type: opts.targetType, target_id: opts.targetId, value: opts.value },
        authToken: opts.authToken ?? null,
      });
    }

    let out: { score: number; userVote: number } | null = null;
    updateDemoState((state) => {
      if (opts.targetType === "prediction") {
        const p = state.predictions.find((x) => x.id === opts.targetId);
        if (!p) throw new Error("Prediction not found");
        const prev = p.userVote ?? 0;
        p.userVote = opts.value;
        p.score = (p.score ?? 0) + (opts.value - prev);
        out = { score: p.score, userVote: p.userVote };
        return;
      }

      // comment: only 0|1 supported
      const list = state.commentsByPredictionId;
      for (const pid of Object.keys(list)) {
        const comments = list[Number(pid)];
        const idx = comments.findIndex((c) => c.id === opts.targetId);
        if (idx === -1) continue;
        const c = comments[idx];
        const prev = c.userVote ?? 0;
        const next = opts.value === 1 ? 1 : 0;
        c.userVote = next as 0 | 1;
        c.score = (c.score ?? 0) + (next - prev);
        out = { score: c.score, userVote: c.userVote };
        return;
      }
      throw new Error("Comment not found");
    });
    if (!out) throw new Error("Vote failed");
    return out;
  },

  async follow(opts: { userId: number; following: boolean; authToken?: string | null }): Promise<{ following: boolean; followerCount: number }> {
    if (!isDemoMode()) {
      if (opts.following) {
        return await apiJson<{ following: boolean; followerCount: number }>(`/api/follow/${opts.userId}`, {
          method: "POST",
          authToken: opts.authToken ?? null,
        });
      }
      return await apiJson<{ following: boolean; followerCount: number }>(`/api/follow/${opts.userId}`, {
        method: "DELETE",
        authToken: opts.authToken ?? null,
      });
    }

    let followerCount = 0;
    updateDemoState((state) => {
      const me = state.currentUserId;
      const list = state.follows[me] ?? [];
      state.follows[me] = opts.following
        ? Array.from(new Set([...list, opts.userId]))
        : list.filter((x) => x !== opts.userId);
      followerCount = Object.values(state.follows).filter((arr) => arr.includes(opts.userId)).length;
    });
    return { following: opts.following, followerCount };
  },

  async placeStake(opts: {
    predictionId: number;
    side: "for" | "against";
    amount: number;
    currency?: string;
    authToken?: string | null;
  }): Promise<{
    stake: {
      id: number;
      userId: number;
      side: "for" | "against";
      amountBaseUnits: string;
      currency: string;
      createdAt: string;
    };
    stakeSummary: { totalFor: string; totalAgainst: string; stakeCount: number };
  }> {
    if (!isDemoMode()) {
      // Current app only supports demo staking on the backend.
      return await apiJson<{
        stake: { id: number; userId: number; side: "for" | "against"; amountBaseUnits: string; currency: string; createdAt: string };
        stakeSummary: { totalFor: string; totalAgainst: string; stakeCount: number };
      }>(`/api/stakes/demo`, {
        method: "POST",
        body: {
          prediction_id: opts.predictionId,
          side: opts.side,
          amount: String(opts.amount.toFixed(2)),
          currency: opts.currency ?? "DEMO",
        },
        authToken: opts.authToken ?? null,
      });
    }

    let result: {
      stake: {
        id: number;
        userId: number;
        side: "for" | "against";
        amountBaseUnits: string;
        currency: string;
        createdAt: string;
      };
      stakeSummary: { totalFor: string; totalAgainst: string; stakeCount: number };
    } | null = null;

    updateDemoState((state) => {
      const pred = state.predictions.find((p) => p.id === opts.predictionId);
      if (!pred) throw new Error("Prediction not found");
      const amtBase = toBaseUnits(opts.amount);
      const createdAt = nowIso();
      const stakeId = state.nextIds.stake++;
      pred.stakes.unshift({
        id: stakeId,
        userId: state.currentUserId,
        side: opts.side,
        amount: amtBase,
        currency: opts.currency ?? "DEMO",
        createdAt,
      });

      const add = (a: string, b: string): string => {
        try {
          return (BigInt(a) + BigInt(b)).toString();
        } catch {
          return a;
        }
      };

      pred.stakeSummary = {
        totalFor: opts.side === "for" ? add(pred.stakeSummary.totalFor, amtBase) : pred.stakeSummary.totalFor,
        totalAgainst: opts.side === "against" ? add(pred.stakeSummary.totalAgainst, amtBase) : pred.stakeSummary.totalAgainst,
        stakeCount: pred.stakeSummary.stakeCount + 1,
      };

      result = {
        stake: {
          id: stakeId,
          userId: state.currentUserId,
          side: opts.side,
          amountBaseUnits: amtBase,
          currency: opts.currency ?? "DEMO",
          createdAt,
        },
        stakeSummary: pred.stakeSummary,
      };
    });

    if (!result) throw new Error("Failed to place stake");
    return result;
  },

  async createPrediction(opts: {
    assetSymbol: string;
    direction: "up" | "down";
    timeframeEnd: number;
    confidence: number;
    authToken?: string | null;
  }): Promise<{ id: number }> {
    if (!isDemoMode()) {
      const data = await apiJson<{ prediction: { id: number } }>(`/api/predictions`, {
        method: "POST",
        body: {
          asset_symbol: opts.assetSymbol,
          direction: opts.direction,
          timeframe_end: opts.timeframeEnd,
          confidence: opts.confidence,
        },
        authToken: opts.authToken ?? null,
      });
      return { id: data.prediction.id };
    }

    let newId = 0;
    updateDemoState((state) => {
      newId = state.nextIds.prediction++;
      const pred: DemoPrediction = {
        id: newId,
        creatorUserId: state.currentUserId,
        assetSymbol: opts.assetSymbol,
        direction: opts.direction,
        timeframeEnd: opts.timeframeEnd,
        confidence: opts.confidence,
        status: "open",
        createdAt: nowIso(),
        settlementPrice: null,
        settlementTimestamp: null,
        stakeSummary: { totalFor: toBaseUnits(0), totalAgainst: toBaseUnits(0), stakeCount: 0 },
        commentsCount: 0,
        score: 0,
        userVote: 0,
        stakes: [],
        reputationEvents: [],
      };
      state.predictions.unshift(pred);
      state.commentsByPredictionId[newId] = [];
    });
    return { id: newId };
  },

  async listLeaderboard(opts?: { limit?: number; period?: "all" | "week"; scope?: "all" | "following"; authToken?: string | null }): Promise<{ summary: LeaderboardSummary; leaderboard: LeaderboardEntry[] }> {
    if (!isDemoMode()) {
      const limit = opts?.limit ?? 50;
      const period = opts?.period ?? "all";
      const scope = opts?.scope ?? "all";
      return await apiJson<{ summary: LeaderboardSummary; leaderboard: LeaderboardEntry[] }>(
        `/api/leaderboard?limit=${limit}&period=${period}&scope=${scope}`,
        { authToken: opts?.authToken ?? null }
      );
    }

    const state = getDemoState();
    const period = opts?.period ?? "all";
    const scope = opts?.scope ?? "all";
    const followed = new Set<number>(state.follows[state.currentUserId] ?? []);

    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = state.users
      .filter((u) => (scope === "following" ? followed.has(u.id) : true))
      .map((u) => {
        const allPreds = state.predictions.filter((p) => p.creatorUserId === u.id);
        const settledPreds = allPreds.filter((p) => p.status === "settled");
        const repEventsAll = state.predictions.flatMap((p) => p.reputationEvents ?? []).filter((e) => e.userId === u.id);
        const repEvents = period === "week"
          ? repEventsAll.filter((e) => new Date(e.createdAt).getTime() >= recentCutoff)
          : repEventsAll;
        const wins = repEvents.filter((e) => e.outcome === "win").length;
        const losses = repEvents.filter((e) => e.outcome === "loss").length;
        const settled = wins + losses;
        const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0;
        const reputationScore = repEvents.reduce((s, e) => s + e.deltaScore, 0);

        // Streak based on last rep events (win/loss only).
        const ordered = [...repEventsAll]
          .filter((e) => e.outcome === "win" || e.outcome === "loss")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        let streak = 0;
        if (ordered.length > 0) {
          const first = ordered[0].outcome;
          for (const e of ordered) {
            if (e.outcome !== first) break;
            streak += first === "win" ? 1 : -1;
          }
        }

        return {
          userId: u.id,
          alienId: `demo:${u.handle}`,
          reputationScore,
          winRate,
          totalPredictions: allPreds.length,
          settledPredictions: settledPreds.length,
          wins,
          losses,
          streak,
        };
      })
      .sort((a, b) => b.reputationScore - a.reputationScore || b.winRate - a.winRate)
      .slice(0, opts?.limit ?? 50)
      .map((r, idx) => ({ rank: idx + 1, ...r }));

    const totalSettledPredictions = state.predictions.filter((p) => p.status === "settled").length;
    return {
      summary: {
        totalPredictors: state.users.length,
        totalSettledPredictions,
        period,
        scope,
      },
      leaderboard: rows,
    };
  },

  async getUserProfile(opts: { userId: number; authToken?: string | null }): Promise<UserProfileResponse> {
    if (!isDemoMode()) {
      return await apiJson<UserProfileResponse>(`/api/users/${opts.userId}/profile`, {
        authToken: opts.authToken ?? null,
      });
    }

    const state = getDemoState();
    const u = state.users.find((x) => x.id === opts.userId);
    if (!u) throw new Error("User not found");
    const followerCount = Object.values(state.follows).filter((arr) => arr.includes(u.id)).length;
    const followingCount = (state.follows[u.id] ?? []).length;
    const isFollowing = creatorIsFollowed(u.id);

    const rep = computeCreatorReputation(u.id);
    const repEvents = state.predictions.flatMap((p) => p.reputationEvents ?? []).filter((e) => e.userId === u.id);
    const wins = repEvents.filter((e) => e.outcome === "win").length;
    const losses = repEvents.filter((e) => e.outcome === "loss").length;
    const totalPredictions = state.predictions.filter((p) => p.creatorUserId === u.id).length;

    return {
      user: { id: u.id, alienId: `demo:${u.handle}`, displayName: u.displayName },
      followerCount,
      followingCount,
      isFollowing,
      stats: {
        winRate: rep.winRate,
        settledPredictions: rep.totalSettled,
        reputationScore: rep.score,
        totalPredictions,
        wins,
        losses,
      },
    };
  },

  async listUserPredictions(opts: { userId: number; limit?: number; authToken?: string | null }): Promise<UserPrediction[]> {
    if (!isDemoMode()) {
      const limit = opts.limit ?? 50;
      const data = await apiJson<{ predictions: UserPrediction[] }>(`/api/users/${opts.userId}/predictions?limit=${limit}`, {
        authToken: opts.authToken ?? null,
      });
      return data.predictions || [];
    }

    const state = getDemoState();
    const list = state.predictions
      .filter((p) => p.creatorUserId === opts.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, opts.limit ?? 50)
      .map((p) => {
        const outcome = p.reputationEvents?.find((e) => e.userId === p.creatorUserId)?.outcome ?? null;
        return {
          id: p.id,
          creatorUserId: p.creatorUserId,
          creatorIsFollowed: creatorIsFollowed(p.creatorUserId),
          assetSymbol: p.assetSymbol,
          direction: p.direction,
          timeframeEnd: p.timeframeEnd,
          confidence: p.confidence,
          status: p.status,
          createdAt: p.createdAt,
          stakeSummary: p.stakeSummary,
          commentsCount: p.commentsCount,
          score: p.score,
          userVote: p.userVote,
          settlementPrice: p.settlementPrice,
          settlementTimestamp: p.settlementTimestamp,
          outcome,
        };
      });
    return list;
  },

  async listUserComments(opts: { userId: number; limit?: number; authToken?: string | null }): Promise<UserComment[]> {
    if (!isDemoMode()) {
      const limit = opts.limit ?? 50;
      const data = await apiJson<{ comments: UserComment[] }>(`/api/users/${opts.userId}/comments?limit=${limit}`, {
        authToken: opts.authToken ?? null,
      });
      return data.comments || [];
    }

    const state = getDemoState();
    const all: DemoComment[] = Object.values(state.commentsByPredictionId).flat();
    return all
      .filter((c) => c.authorUserId === opts.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, opts.limit ?? 50)
      .map((c) => ({
        id: c.id,
        predictionId: c.predictionId,
        authorUserId: c.authorUserId,
        body: c.body,
        createdAt: c.createdAt,
        score: c.score,
        userVote: c.userVote,
      }));
  },
};
