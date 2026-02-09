"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/MiniKitProvider";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PredictionCardExpanded } from "@/components/PredictionCardExpanded";
import { BetSheet } from "@/components/BetSheet";
import { SkeletonPredictionCard } from "@/components/SkeletonPredictionCard";
import { Skeleton, SkeletonText } from "@/components/Skeleton";
import { dataClient } from "@/lib/data/dataClient";
import { formatBaseUnits1e18 } from "@/lib/ui/format";

type Stake = {
  id: number;
  userId: number;
  side: "for" | "against";
  amount: string;
  currency: string;
  createdAt: string;
};

type Comment = {
  id: number;
  predictionId: number;
  authorUserId: number;
  body: string;
  createdAt: string;
  score?: number;
  userVote?: 0 | 1;
};

type ReputationEvent = {
  id: number;
  userId: number;
  outcome: "win" | "loss" | "neutral";
  deltaScore: number;
  createdAt: string;
};

type PredictionDetail = {
  id: number;
  creatorUserId: number;
  assetSymbol: string;
  direction: "up" | "down";
  timeframeEnd: number;
  confidence: number;
  status: string;
  settlementPrice: string | null;
  settlementTimestamp: number | null;
  createdAt: string;
  score?: number;
  userVote?: -1 | 0 | 1;
  creatorReputation: {
    winRate: number;
    totalSettled: number;
    score: number;
  };
  stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  };
  commentsCount?: number;
  stakes: Stake[];
  reputationEvents?: ReputationEvent[];
};

export default function PredictionPage() {
  const { id } = useParams<{ id: string }>();
  const { authToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [commentSort, setCommentSort] = useState<"top" | "new">("top");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [predScore, setPredScore] = useState<number>(0);
  const [predVote, setPredVote] = useState<-1 | 0 | 1>(0);
  const [betOpen, setBetOpen] = useState(false);
  const betRollbackRef = useRef<null | (() => void)>(null);
  const demoMode = dataClient.demoMode();
  const judgeMode =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_JUDGE_MODE === "true";
  const [judgeOn, setJudgeOn] = useState(false);

  useEffect(() => {
    fetchPrediction();
  }, [id]);

  useEffect(() => {
    if (!judgeMode) return;
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("anchorsignal_judge_mode")
        : null;
    setJudgeOn(stored === "true");
  }, [judgeMode]);

  useEffect(() => {
    fetchComments();
  }, [id, commentSort, authToken]);

  async function fetchPrediction() {
    try {
      const pred = await dataClient.getPrediction(id, { authToken });
      setPrediction(pred as PredictionDetail);
      setPredScore(Number(pred?.score ?? 0));
      setPredVote((Number(pred?.userVote ?? 0) as -1 | 0 | 1) ?? 0);
    } catch {
      setError("Failed to load prediction");
    } finally {
      setLoading(false);
    }
  }

  async function fetchComments() {
    setCommentsLoading(true);
    try {
      const predictionId = parseInt(String(id), 10);
      if (!Number.isFinite(predictionId)) return;
      const list = await dataClient.listComments(predictionId, {
        limit: 100,
        sort: commentSort,
        authToken,
      });
      setComments(list as Comment[]);
    } catch {
      // ignore
    } finally {
      setCommentsLoading(false);
    }
  }

  async function votePrediction(nextVote: -1 | 0 | 1) {
    if (!authToken) {
      setToast("Verify in Alien to vote.");
      window.setTimeout(() => setToast(null), 1800);
      return;
    }

    const prevVote = predVote;
    const prevScore = predScore;
    setPredScore((s) => s + (nextVote - predVote));
    setPredVote(nextVote);

    try {
      const data = await dataClient.vote({
        targetType: "prediction",
        targetId: Number(id),
        value: nextVote,
        authToken,
      });
      setPredScore(Number(data.score ?? 0));
      setPredVote((Number(data.userVote ?? 0) as -1 | 0 | 1) ?? 0);
    } catch {
      setPredVote(prevVote);
      setPredScore(prevScore);
    }
  }

  async function voteComment(commentId: number, nextVote: 0 | 1) {
    if (!authToken) {
      setToast("Verify in Alien to vote.");
      window.setTimeout(() => setToast(null), 1800);
      return;
    }

    const prev = comments;
    setComments((list) =>
      list.map((c) => {
        if (c.id !== commentId) return c;
        const currentVote = c.userVote ?? 0;
        const currentScore = c.score ?? 0;
        return {
          ...c,
          userVote: nextVote,
          score: currentScore + (nextVote - currentVote),
        };
      })
    );

    try {
      const data = await dataClient.vote({
        targetType: "comment",
        targetId: commentId,
        value: nextVote,
        authToken,
      });
      setComments((list) =>
        list.map((c) =>
          c.id === commentId
            ? {
                ...c,
                score: Number(data.score ?? c.score ?? 0),
                userVote: (Number(data.userVote ?? c.userVote ?? 0) as 0 | 1) ?? 0,
              }
            : c
        )
      );
    } catch {
      setComments(prev);
    }
  }

  async function submitComment() {
    if (!authToken) return;
    const body = commentBody.trim();
    if (body.length < 1) return;

    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const predictionId = parseInt(String(id), 10);
      if (!Number.isFinite(predictionId)) return;
      await dataClient.createComment({ predictionId, body, authToken });
      setCommentBody("");
      await fetchComments();
    } catch {
      setCommentError("Network error");
    } finally {
      setCommentSubmitting(false);
    }
  }

  function handleFromUserId(userId: number): string {
    return `signal${userId}`;
  }

  function avatarBgFromId(userId: number): string {
    const hues = [25, 190, 280, 140, 330, 210, 70];
    const hue = hues[userId % hues.length];
    return `hsl(${hue} 70% 45%)`;
  }

  function tsLabel(iso: string): string {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="sticky top-0 z-20 border-b border-zinc-200 bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 rounded-lg" />
              <div className="mt-2">
                <Skeleton className="h-3 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <main className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-4 space-y-4">
          <SkeletonPredictionCard />
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-44 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-lg" />
            </div>
            <div className="mt-4">
              <SkeletonText lines={3} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <p className="text-red-600 mb-4">{error || "Not found"}</p>
        <Link href="/" className="text-primary font-medium">Back to home</Link>
      </div>
    );
  }

  const headerSummary = `${prediction.assetSymbol} ${prediction.direction === "up" ? "UP" : "DOWN"}`;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800"
            aria-label="Back"
          >
            <span className="text-lg">←</span>
          </Link>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold tracking-tight">
              {headerSummary}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Prediction #{prediction.id}
              {demoMode ? " · Demo Mode" : judgeMode && judgeOn ? " · Demo" : ""}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-4">
        {/* Prediction header card */}
        <PredictionCardExpanded
          prediction={prediction}
          onBet={() => setBetOpen(true)}
        />

        {judgeMode && judgeOn && !demoMode && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Judge Mode</div>
              <button
                type="button"
                onClick={async () => {
                  if (!authToken) {
                    setToast("Verify in Alien (admin) to settle.");
                    window.setTimeout(() => setToast(null), 1500);
                    return;
                  }
                  try {
                    const res = await fetch(`/api/dev/predictions/${prediction.id}/settle-now`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`,
                      },
                      body: JSON.stringify({}),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok) throw new Error(data?.error || "settle failed");
                    setToast(`Settled now (${data.outcome}).`);
                    window.setTimeout(() => setToast(null), 1800);
                    await fetchPrediction();
                  } catch {
                    setToast("Settle failed (admin + JUDGE_MODE required).");
                    window.setTimeout(() => setToast(null), 1800);
                  }
                }}
                className="inline-flex items-center rounded-full bg-amber-900 px-3 py-1.5 text-[11px] font-semibold text-white dark:bg-amber-200 dark:text-amber-950"
              >
                Settle now
              </button>
            </div>
            <div className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-200/80">
              Settles instantly without external price oracles.
            </div>
          </div>
        )}

        {/* Thread controls */}
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex items-center justify-between gap-2 p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("comments")}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${
                  tab === "comments"
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                }`}
              >
                Comments
              </button>
              <button
                type="button"
                onClick={() => setTab("activity")}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${
                  tab === "activity"
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                }`}
              >
                Activity
              </button>
            </div>

            <div className="flex items-center gap-2 pr-2">
              <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-300 dark:ring-zinc-800 tabular-nums">
                ▲ {predScore}
              </span>
              <button
                type="button"
                onClick={() => void votePrediction(predVote === 1 ? 0 : 1)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset transition ${
                  predVote === 1
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-900/40"
                }`}
                aria-label="Upvote prediction"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => void votePrediction(predVote === -1 ? 0 : -1)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset transition ${
                  predVote === -1
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-900/40"
                }`}
                aria-label="Downvote prediction"
              >
                ▼
              </button>
            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800" />

          {tab === "comments" ? (
            <div className="p-4">
              {commentsLoading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-300 dark:ring-zinc-800">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                    Start the thread
                  </div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    No comments yet. Add the first take, ask for sources, or challenge the market.
                  </div>
                  {judgeMode && judgeOn && !demoMode && authToken && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/dev/predictions/${prediction.id}/seed-thread`,
                            {
                              method: "POST",
                              headers: { Authorization: `Bearer ${authToken}` },
                            }
                          );
                          if (!res.ok) throw new Error("seed failed");
                          await fetchPrediction();
                          await fetchComments();
                          setToast("Sample thread added.");
                          window.setTimeout(() => setToast(null), 1400);
                        } catch {
                          setToast("Seed failed (JUDGE_MODE required).");
                          window.setTimeout(() => setToast(null), 1600);
                        }
                      }}
                      className="mt-3 inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
                    >
                      Add sample thread
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950/20">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50/70 dark:bg-zinc-950/30 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {comments.length} comment{comments.length === 1 ? "" : "s"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCommentSort("top")}
                        className={`text-xs font-semibold ${
                          commentSort === "top"
                            ? "text-zinc-900 dark:text-zinc-50"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        Top
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <button
                        type="button"
                        onClick={() => setCommentSort("new")}
                        className={`text-xs font-semibold ${
                          commentSort === "new"
                            ? "text-zinc-900 dark:text-zinc-50"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        New
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="h-9 w-9 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                          style={{ background: avatarBgFromId(c.authorUserId) }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                @{handleFromUserId(c.authorUserId)}
                              </div>
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {tsLabel(c.createdAt)}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void voteComment(c.id, (c.userVote ?? 0) === 1 ? 0 : 1)
                              }
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                                (c.userVote ?? 0) === 1
                                  ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                                  : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                              }`}
                              aria-label="Upvote comment"
                            >
                              ▲ <span className="tabular-nums">{c.score ?? 0}</span>
                            </button>
                          </div>

                          <div className="mt-2 text-sm text-zinc-900 dark:text-zinc-50 whitespace-pre-wrap">
                            {c.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              {/* Timeline */}
              {(() => {
                type Item =
                  | { type: "stake"; ts: number; stake: Stake }
                  | { type: "settlement"; ts: number }
                  | { type: "rep"; ts: number; ev: ReputationEvent };

                const items: Item[] = [];
                for (const s of prediction.stakes) {
                  items.push({ type: "stake", ts: new Date(s.createdAt).getTime(), stake: s });
                }
                if (prediction.settlementTimestamp) {
                  items.push({ type: "settlement", ts: prediction.settlementTimestamp * 1000 });
                }
                if (prediction.reputationEvents) {
                  for (const e of prediction.reputationEvents) {
                    items.push({ type: "rep", ts: new Date(e.createdAt).getTime(), ev: e });
                  }
                }
                items.sort((a, b) => b.ts - a.ts);

                if (items.length === 0) {
                  return (
                    <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-300 dark:ring-zinc-800">
                      No activity yet. Place a bet or leave a comment to start the thread.
                    </div>
                  );
                }

                return (
                  <div className="relative pl-7">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />
                    <div className="space-y-3">
                      {items.map((it, idx) => (
                        <div key={`${it.type}-${idx}-${it.ts}`} className="relative">
                          <div className="absolute left-[9px] top-3 h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-zinc-50" />
                          <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
                            {it.type === "stake" ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm text-zinc-900 dark:text-zinc-50">
                                  <span className="font-semibold">
                                    @{handleFromUserId(it.stake.userId)}
                                  </span>{" "}
                                  placed{" "}
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                                      it.stake.side === "for"
                                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900"
                                        : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900"
                                    }`}
                                  >
                                    {it.stake.side === "for" ? "FOR" : "AGAINST"}
                                  </span>
                                </div>
                                <div className="text-sm font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                                  {formatBaseUnits1e18(it.stake.amount)} {it.stake.currency}
                                </div>
                              </div>
                            ) : it.type === "settlement" ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                  Settled
                                </div>
                                <div className="text-sm font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                                  ${prediction.settlementPrice}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm text-zinc-900 dark:text-zinc-50">
                                  <span className="font-semibold">
                                    @{handleFromUserId(it.ev.userId)}
                                  </span>{" "}
                                  reputation
                                </div>
                                <div
                                  className={`text-sm font-extrabold tabular-nums ${
                                    it.ev.deltaScore >= 0
                                      ? "text-emerald-700 dark:text-emerald-300"
                                      : "text-rose-700 dark:text-rose-300"
                                  }`}
                                >
                                  {it.ev.deltaScore >= 0 ? "+" : ""}
                                  {it.ev.deltaScore}
                                </div>
                              </div>
                            )}
                            <div className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                              {new Date(it.ts).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
          {!authLoading && !isAuthenticated ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
              <div>Verify to comment</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Open in Alien
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={1}
                  placeholder="Write a comment..."
                  className="w-full resize-none bg-transparent px-2 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
                />
              </div>
              <button
                type="button"
                disabled={!authToken || commentSubmitting || commentBody.trim().length < 1}
                onClick={submitComment}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
              >
                {commentSubmitting ? "Posting..." : "Submit"}
              </button>
            </div>
          )}
          {commentError && (
            <div className="mt-2 text-xs text-rose-600">{commentError}</div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 mx-auto max-w-2xl px-4">
          <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-950">
            {toast}
          </div>
        </div>
      )}

      <BetSheet
        open={betOpen}
        prediction={
          prediction
            ? {
                id: prediction.id,
                assetSymbol: prediction.assetSymbol,
                direction: prediction.direction,
                stakeSummary: prediction.stakeSummary,
              }
            : null
        }
        authToken={authToken}
        onClose={() => setBetOpen(false)}
        onRequireAuth={() => {
          setToast("Verify in Alien to place demo bets.");
          window.setTimeout(() => setToast(null), 1800);
        }}
        onOptimistic={(stakeSummary) => {
          if (!prediction) return;
          const prev = prediction.stakeSummary;
          betRollbackRef.current = () => {
            setPrediction((p) => (p ? { ...p, stakeSummary: prev } : p));
          };
          setPrediction((p) =>
            p
              ? {
                  ...p,
                  stakeSummary: {
                    ...p.stakeSummary,
                    totalFor: stakeSummary.totalFor,
                    totalAgainst: stakeSummary.totalAgainst,
                    stakeCount: stakeSummary.stakeCount,
                  },
                }
              : p
          );
        }}
        onOptimisticRollback={() => {
          betRollbackRef.current?.();
          betRollbackRef.current = null;
        }}
        onSuccess={({ stake, stakeSummary }) => {
          setToast("Bet confirmed (demo).");
          window.setTimeout(() => setToast(null), 1800);
          betRollbackRef.current = null;
          setPrediction((p) =>
            p
              ? {
                  ...p,
                  stakeSummary: {
                    ...p.stakeSummary,
                    totalFor: stakeSummary.totalFor,
                    totalAgainst: stakeSummary.totalAgainst,
                    stakeCount: stakeSummary.stakeCount,
                  },
                  stakes: [
                    {
                      id: stake.id,
                      userId: stake.userId,
                      side: stake.side,
                      amount: stake.amountBaseUnits,
                      currency: stake.currency,
                      createdAt: stake.createdAt,
                    },
                    ...p.stakes,
                  ],
                }
              : p
          );
        }}
      />
    </div>
  );
}
