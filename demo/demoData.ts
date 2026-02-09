export type DemoUser = {
  id: number;
  handle: string;
  displayName: string;
};

export type DemoStake = {
  id: number;
  userId: number;
  side: "for" | "against";
  amount: string; // base units (1e18)
  currency: string; // "DEMO"
  createdAt: string; // ISO
};

export type DemoReputationEvent = {
  id: number;
  userId: number;
  outcome: "win" | "loss" | "neutral";
  deltaScore: number;
  createdAt: string; // ISO
};

export type DemoComment = {
  id: number;
  predictionId: number;
  authorUserId: number;
  body: string;
  createdAt: string; // ISO
  score: number;
  userVote: 0 | 1;
};

export type DemoPrediction = {
  id: number;
  creatorUserId: number;
  assetSymbol: string;
  direction: "up" | "down";
  timeframeEnd: number; // unix seconds
  confidence: number;
  status: "open" | "settled" | "cancelled";
  createdAt: string; // ISO
  settlementPrice: string | null;
  settlementTimestamp: number | null; // unix seconds
  stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  };
  commentsCount: number;
  score: number;
  userVote: -1 | 0 | 1;
  stakes: DemoStake[];
  reputationEvents: DemoReputationEvent[];
};

export type DemoState = {
  users: DemoUser[];
  currentUserId: number;
  follows: Record<number, number[]>; // follower -> followed ids
  predictions: DemoPrediction[];
  commentsByPredictionId: Record<number, DemoComment[]>;
  nextIds: {
    prediction: number;
    comment: number;
    stake: number;
    rep: number;
  };
};

function toBaseUnits(amount: number): string {
  return String(Math.round(amount * 1e18));
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function unixDaysFromNow(days: number): number {
  return Math.floor((Date.now() + days * 24 * 60 * 60 * 1000) / 1000);
}

function unixHoursFromNow(hours: number): number {
  return Math.floor((Date.now() + hours * 60 * 60 * 1000) / 1000);
}

export function makeInitialDemoState(): DemoState {
  const users: DemoUser[] = [
    { id: 1, handle: "you", displayName: "You" },
    { id: 2, handle: "atlas", displayName: "Atlas" },
    { id: 3, handle: "nova", displayName: "Nova" },
    { id: 4, handle: "horizon", displayName: "Horizon" },
    { id: 5, handle: "ember", displayName: "Ember" },
    { id: 6, handle: "drift", displayName: "Drift" },
    { id: 7, handle: "quartz", displayName: "Quartz" },
    { id: 8, handle: "sable", displayName: "Sable" },
  ];

  // Make "Following" tab feel alive by default.
  const follows: Record<number, number[]> = {
    1: [2, 3, 4],
  };

  // A mix of open + settled, with realistic-looking pools, scores, and comments.
  const basePreds: Omit<DemoPrediction, "stakes" | "reputationEvents">[] = [
    {
      id: 101,
      creatorUserId: 2,
      assetSymbol: "BTC",
      direction: "up",
      timeframeEnd: unixHoursFromNow(18),
      confidence: 78,
      status: "open",
      createdAt: isoHoursAgo(6),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(8.4),
        totalAgainst: toBaseUnits(5.2),
        stakeCount: 17,
      },
      commentsCount: 9,
      score: 23,
      userVote: 0,
    },
    {
      id: 102,
      creatorUserId: 3,
      assetSymbol: "ETH",
      direction: "down",
      timeframeEnd: unixDaysFromNow(3),
      confidence: 61,
      status: "open",
      createdAt: isoHoursAgo(2),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(3.1),
        totalAgainst: toBaseUnits(7.9),
        stakeCount: 14,
      },
      commentsCount: 4,
      score: 8,
      userVote: 1,
    },
    {
      id: 103,
      creatorUserId: 4,
      assetSymbol: "SOL",
      direction: "up",
      timeframeEnd: unixDaysFromNow(7),
      confidence: 84,
      status: "open",
      createdAt: isoHoursAgo(14),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(12.6),
        totalAgainst: toBaseUnits(2.2),
        stakeCount: 22,
      },
      commentsCount: 12,
      score: 41,
      userVote: 0,
    },
    {
      id: 104,
      creatorUserId: 5,
      assetSymbol: "WLD",
      direction: "down",
      timeframeEnd: unixHoursFromNow(5),
      confidence: 69,
      status: "open",
      createdAt: isoHoursAgo(1),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(1.4),
        totalAgainst: toBaseUnits(1.9),
        stakeCount: 6,
      },
      commentsCount: 2,
      score: -3,
      userVote: 0,
    },
    {
      id: 107,
      creatorUserId: 8,
      assetSymbol: "SOL",
      direction: "down",
      timeframeEnd: unixHoursFromNow(9),
      confidence: 66,
      status: "open",
      createdAt: isoHoursAgo(5),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(4.6),
        totalAgainst: toBaseUnits(4.1),
        stakeCount: 11,
      },
      commentsCount: 7,
      score: 14,
      userVote: 0,
    },
    {
      id: 108,
      creatorUserId: 2,
      assetSymbol: "ETH",
      direction: "up",
      timeframeEnd: unixDaysFromNow(5),
      confidence: 73,
      status: "open",
      createdAt: isoHoursAgo(20),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(9.2),
        totalAgainst: toBaseUnits(6.7),
        stakeCount: 26,
      },
      commentsCount: 5,
      score: 19,
      userVote: 0,
    },
    {
      id: 109,
      creatorUserId: 3,
      assetSymbol: "BTC",
      direction: "down",
      timeframeEnd: unixDaysFromNow(2),
      confidence: 58,
      status: "open",
      createdAt: isoHoursAgo(9),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(2.0),
        totalAgainst: toBaseUnits(3.9),
        stakeCount: 10,
      },
      commentsCount: 3,
      score: 2,
      userVote: 0,
    },
    {
      id: 110,
      creatorUserId: 4,
      assetSymbol: "WLD",
      direction: "up",
      timeframeEnd: unixHoursFromNow(28),
      confidence: 81,
      status: "open",
      createdAt: isoHoursAgo(12),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(6.1),
        totalAgainst: toBaseUnits(1.6),
        stakeCount: 13,
      },
      commentsCount: 8,
      score: 27,
      userVote: 0,
    },
    {
      id: 111,
      creatorUserId: 5,
      assetSymbol: "ETH",
      direction: "down",
      timeframeEnd: unixDaysFromNow(9),
      confidence: 62,
      status: "open",
      createdAt: isoHoursAgo(28),
      settlementPrice: null,
      settlementTimestamp: null,
      stakeSummary: {
        totalFor: toBaseUnits(5.8),
        totalAgainst: toBaseUnits(8.5),
        stakeCount: 21,
      },
      commentsCount: 10,
      score: 11,
      userVote: 0,
    },
    {
      id: 105,
      creatorUserId: 6,
      assetSymbol: "BTC",
      direction: "down",
      timeframeEnd: unixDaysFromNow(1),
      confidence: 72,
      status: "settled",
      createdAt: isoHoursAgo(40),
      settlementPrice: "58320",
      settlementTimestamp: Math.floor((Date.now() - 8 * 60 * 60 * 1000) / 1000),
      stakeSummary: {
        totalFor: toBaseUnits(6.8),
        totalAgainst: toBaseUnits(9.7),
        stakeCount: 19,
      },
      commentsCount: 6,
      score: 17,
      userVote: 0,
    },
    {
      id: 106,
      creatorUserId: 7,
      assetSymbol: "ETH",
      direction: "up",
      timeframeEnd: unixDaysFromNow(2),
      confidence: 57,
      status: "settled",
      createdAt: isoHoursAgo(60),
      settlementPrice: "3270",
      settlementTimestamp: Math.floor((Date.now() - 20 * 60 * 60 * 1000) / 1000),
      stakeSummary: {
        totalFor: toBaseUnits(2.7),
        totalAgainst: toBaseUnits(1.1),
        stakeCount: 9,
      },
      commentsCount: 3,
      score: 5,
      userVote: 0,
    },
    {
      id: 112,
      creatorUserId: 2,
      assetSymbol: "SOL",
      direction: "up",
      timeframeEnd: unixDaysFromNow(1),
      confidence: 76,
      status: "settled",
      createdAt: isoHoursAgo(72),
      settlementPrice: "148.30",
      settlementTimestamp: Math.floor((Date.now() - 12 * 60 * 60 * 1000) / 1000),
      stakeSummary: {
        totalFor: toBaseUnits(4.1),
        totalAgainst: toBaseUnits(3.0),
        stakeCount: 12,
      },
      commentsCount: 4,
      score: 9,
      userVote: 0,
    },
    {
      id: 113,
      creatorUserId: 3,
      assetSymbol: "WLD",
      direction: "down",
      timeframeEnd: unixDaysFromNow(4),
      confidence: 59,
      status: "settled",
      createdAt: isoHoursAgo(90),
      settlementPrice: "2.11",
      settlementTimestamp: Math.floor((Date.now() - 30 * 60 * 60 * 1000) / 1000),
      stakeSummary: {
        totalFor: toBaseUnits(3.6),
        totalAgainst: toBaseUnits(5.4),
        stakeCount: 16,
      },
      commentsCount: 7,
      score: 6,
      userVote: 0,
    },
    {
      id: 114,
      creatorUserId: 8,
      assetSymbol: "BTC",
      direction: "up",
      timeframeEnd: unixDaysFromNow(6),
      confidence: 64,
      status: "settled",
      createdAt: isoHoursAgo(120),
      settlementPrice: "60210",
      settlementTimestamp: Math.floor((Date.now() - 52 * 60 * 60 * 1000) / 1000),
      stakeSummary: {
        totalFor: toBaseUnits(10.8),
        totalAgainst: toBaseUnits(7.7),
        stakeCount: 31,
      },
      commentsCount: 11,
      score: 22,
      userVote: 0,
    },
  ];

  const predictions: DemoPrediction[] = basePreds.map((p, idx) => {
    const stakes: DemoStake[] = Array.from({ length: Math.min(6, 2 + (idx % 5)) }).map(
      (_, i) => ({
        id: 2000 + idx * 10 + i,
        userId: users[1 + ((idx + i) % (users.length - 1))].id,
        side: i % 2 === 0 ? "for" : "against",
        amount: toBaseUnits(0.8 + ((idx + i) % 7) * 0.6),
        currency: "DEMO",
        createdAt: isoHoursAgo(1 + i + idx),
      })
    );

    const rep: DemoReputationEvent[] =
      p.status === "settled"
        ? (() => {
            const creatorOutcome = idx % 2 === 0 ? "win" : "loss";
            const creatorDelta = (creatorOutcome === "win" ? 1 : -1) * p.confidence;
            const stakerA = stakes[0]?.userId ?? users[1].id;
            const stakerB = stakes[1]?.userId ?? users[2].id;
            const createdAt = isoHoursAgo(6 + idx);
            return [
              {
                id: 9000 + idx * 10 + 0,
                userId: p.creatorUserId,
                outcome: creatorOutcome,
                deltaScore: creatorDelta,
                createdAt,
              },
              {
                id: 9000 + idx * 10 + 1,
                userId: stakerA,
                outcome: "win",
                deltaScore: Math.round(p.confidence * 0.4),
                createdAt,
              },
              {
                id: 9000 + idx * 10 + 2,
                userId: stakerB,
                outcome: "loss",
                deltaScore: -Math.round(p.confidence * 0.25),
                createdAt,
              },
            ];
          })()
        : [];

    return { ...p, stakes, reputationEvents: rep };
  });

  const commentsByPredictionId: Record<number, DemoComment[]> = {};
  let nextCommentId = 5000;
  for (const p of predictions) {
    const count = Math.max(3, Math.min(12, p.commentsCount));
    const bodies = [
      "What’s the catalyst?",
      "Source link?",
      "Sizing small, but I’m in.",
      "I’m taking the other side.",
      "This is mispriced.",
      "Following this one.",
    ];
    commentsByPredictionId[p.id] = Array.from({ length: count }).map((_, i) => {
      const authorUserId = users[2 + ((p.id + i) % (users.length - 2))].id;
      return {
        id: nextCommentId++,
        predictionId: p.id,
        authorUserId,
        body: bodies[(p.id + i) % bodies.length],
        createdAt: isoHoursAgo(2 + i),
        score: (p.id + i) % 7,
        userVote: 0,
      };
    });
    p.commentsCount = count;
  }

  return {
    users,
    currentUserId: 1,
    follows,
    predictions,
    commentsByPredictionId,
    nextIds: {
      prediction: 1000,
      comment: nextCommentId,
      stake: 8000,
      rep: 12000,
    },
  };
}
