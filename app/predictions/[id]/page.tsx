"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/MiniKitProvider";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PredictionCardExpanded } from "@/components/PredictionCardExpanded";
import { BetSheet } from "@/components/BetSheet";
import { SkeletonPredictionCard } from "@/components/SkeletonPredictionCard";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

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
      const res = await fetch(`/api/predictions/${id}`);
      if (!res.ok) {
        setError("Prediction not found");
        return;
      }
      const data = await res.json();
      setPrediction(data.prediction);
      setPredScore(Number(data.prediction?.score ?? 0));
      setPredVote((Number(data.prediction?.userVote ?? 0) as -1 | 0 | 1) ?? 0);
    } catch {
      setError("Failed to load prediction");
    } finally {
      setLoading(false);
    }
  }

  async function fetchComments() {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/predictions/${id}/comments?limit=100&sort=${commentSort}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments || []);
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
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          target_type: "prediction",
          target_id: Number(id),
          value: nextVote,
        }),
      });
      if (!res.ok) throw new Error("vote failed");
      const data = await res.json();
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
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          target_type: "comment",
          target_id: commentId,
          value: nextVote,
        }),
      });
      if (!res.ok) throw new Error("vote failed");
      const data = await res.json();
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
      const res = await fetch(`/api/predictions/${id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCommentError(data?.error || "Failed to post comment");
        return;
      }

      setCommentBody("");
      await fetchComments();
    } catch {
      setCommentError("Network error");
    } finally {
      setCommentSubmitting(false);
    }
  }

  function formatWLD(baseUnits: string): string {
    const wld = Number(baseUnits) / 1e18;
    return wld.toFixed(2);
  }

  function handleFromUserId(userId: number): string {
    return `signal${userId}`;
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
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-4">
        <PredictionCardExpanded
          prediction={prediction}
          onBet={() => {
            setBetOpen(true);
          }}
        />

        {judgeMode && judgeOn && (
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

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Score: <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{predScore}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void votePrediction(predVote === 1 ? 0 : 1)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset transition ${
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
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset transition ${
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

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 p-2 dark:border-zinc-800">
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
                Comments ({prediction.commentsCount ?? comments.length})
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

            {tab === "comments" && (
              <div className="flex items-center gap-2 pr-2">
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
            )}
          </div>

          {tab === "comments" ? (
            <div className="p-4">
              {commentsLoading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  No comments yet. Be the first.
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          @{handleFromUserId(c.authorUserId)}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {new Date(c.createdAt).toLocaleString()}
                          </div>
                          <button
                            type="button"
                            onClick={() => void voteComment(c.id, (c.userVote ?? 0) === 1 ? 0 : 1)}
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
                      </div>
                      <div className="mt-2 text-sm text-zinc-900 dark:text-zinc-50 whitespace-pre-wrap">
                        {c.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <div className="space-y-3">
                {prediction.settlementTimestamp && (
                  <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
                    <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Settlement
                    </div>
                    <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                      Settled at{" "}
                      <span className="font-semibold">
                        ${prediction.settlementPrice}
                      </span>{" "}
                      on{" "}
                      {new Date(prediction.settlementTimestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                )}

                {prediction.stakes.length > 0 ? (
                  <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
                    <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Stakes placed
                    </div>
                    <div className="mt-2 space-y-2">
                      {prediction.stakes.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="text-zinc-600 dark:text-zinc-300">
                            @{handleFromUserId(s.userId)}{" "}
                            <span
                              className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                                s.side === "for"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900"
                                  : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900"
                              }`}
                            >
                              {s.side === "for" ? "FOR" : "AGAINST"}
                            </span>
                          </div>
                          <div className="text-zinc-900 dark:text-zinc-50 font-semibold">
                            {formatWLD(s.amount)} {s.currency}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    No stakes yet.
                  </div>
                )}

                {prediction.reputationEvents && prediction.reputationEvents.length > 0 && (
                  <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
                    <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Reputation impacts
                    </div>
                    <div className="mt-2 space-y-2">
                      {prediction.reputationEvents.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-sm">
                          <div className="text-zinc-600 dark:text-zinc-300">
                            @{handleFromUserId(e.userId)}{" "}
                            <span className="text-zinc-400 dark:text-zinc-500">
                              ({e.outcome})
                            </span>
                          </div>
                          <div
                            className={`font-semibold ${
                              e.deltaScore >= 0
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {e.deltaScore >= 0 ? "+" : ""}
                            {e.deltaScore}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
        onSuccess={({ stake, stakeSummary }) => {
          setToast("Bet confirmed (demo).");
          window.setTimeout(() => setToast(null), 1800);
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
