"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/MiniKitProvider";
import Link from "next/link";
import { PredictionCard, type FeedPrediction } from "@/components/PredictionCard";
import { BetSheet } from "@/components/BetSheet";
import { SkeletonPredictionCard } from "@/components/SkeletonPredictionCard";

type Prediction = FeedPrediction & {
  commentsCount?: number;
  creatorReputation?: {
    winRate: number;
    totalSettled: number;
    score: number;
  };
};

type FeedTab = "trending" | "new" | "following" | "settling_soon";

function isSettlingSoon(timeframeEnd: number): boolean {
  const msLeft = timeframeEnd * 1000 - Date.now();
  return msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000;
}

function predictionStakeWld(pred: Prediction): number {
  const total = Number(pred.stakeSummary.totalFor) + Number(pred.stakeSummary.totalAgainst);
  if (!Number.isFinite(total)) return 0;
  return total / 1e18;
}

function hotScore(pred: Prediction): number {
  const ageHours = Math.max(
    0,
    (Date.now() - new Date(pred.createdAt).getTime()) / (1000 * 60 * 60)
  );
  const stake = predictionStakeWld(pred);
  const score = pred.score ?? 0;
  const raw = score * 2 + Math.log10(1 + stake) * 6 + stake * 0.15;
  const decay = 1 / Math.pow(1 + ageHours / 6, 1.35);
  return raw * decay;
}

export default function Home() {
  const { isAuthenticated, user, isLoading, authToken } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FeedTab>("trending");
  const [toast, setToast] = useState<string | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [betPrediction, setBetPrediction] = useState<Prediction | null>(null);
  const betRollbackRef = useRef<null | (() => void)>(null);
  const judgeMode =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_JUDGE_MODE === "true";
  const [judgeOn, setJudgeOn] = useState(false);

  useEffect(() => {
    fetchPredictions();
  }, [authToken]);

  useEffect(() => {
    if (!judgeMode) return;
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("anchorsignal_judge_mode")
        : null;
    setJudgeOn(stored === "true");
  }, [judgeMode]);

  useEffect(() => {
    if (!judgeMode || !judgeOn) return;
    if (!authToken) return;
    // One-time autoseed for smooth demos.
    const seeded =
      typeof window !== "undefined"
        ? window.localStorage.getItem("anchorsignal_judge_autoseeded")
        : null;
    if (seeded === "true") return;
    if (predictions.length > 0) return;

    (async () => {
      try {
        const res = await fetch("/api/dev/seed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ users: 8, predictions: 14, comments_per_prediction: 4 }),
        });
        if (!res.ok) return;
        window.localStorage.setItem("anchorsignal_judge_autoseeded", "true");
        await fetchPredictions();
      } catch {
        // ignore
      }
    })();
  }, [authToken, judgeMode, judgeOn, predictions.length]);

  async function fetchPredictions() {
    try {
      const res = await fetch("/api/predictions?limit=20", {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (!res.ok) {
        console.error("Failed to fetch predictions:", res.status);
        return;
      }
      const data = await res.json();
      setPredictions(data.predictions || []);
    } catch (err) {
      console.error("Failed to fetch predictions:", err);
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <div className="h-10 w-40 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70 animate-pulse" />
          <div className="mt-5 space-y-3 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            <SkeletonPredictionCard />
            <SkeletonPredictionCard />
            <SkeletonPredictionCard />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-4">AnchorSignal</h1>
          <p className="text-gray-600 dark:text-zinc-400 mb-6">
            A social prediction market for verified humans. Open in Alien to start.
          </p>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-4">
            Connecting...
          </p>
        </div>
      </div>
    );
  }

  const filteredPredictions =
    tab === "following"
      ? predictions.filter((p) => p.creatorIsFollowed)
      : tab === "settling_soon"
        ? predictions.filter((p) => isSettlingSoon(p.timeframeEnd))
        : predictions;

  const sortedPredictions =
    tab === "new"
      ? [...filteredPredictions].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      : tab === "trending"
        ? [...filteredPredictions].sort((a, b) => {
            return hotScore(b) - hotScore(a);
          })
        : filteredPredictions;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-extrabold tracking-tight truncate">
                  AnchorSignal
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60">
                  Verified
                </span>
                {judgeMode && judgeOn && (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800">
                    Demo
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Feed
              </div>
            </div>

            <div className="flex items-center gap-2">
              {judgeMode && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !judgeOn;
                    setJudgeOn(next);
                    window.localStorage.setItem("anchorsignal_judge_mode", String(next));
                    setToast(next ? "Judge Mode enabled" : "Judge Mode disabled");
                    window.setTimeout(() => setToast(null), 1200);
                  }}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-inset ${
                    judgeOn
                      ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60"
                      : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                  }`}
                >
                  Judge
                </button>
              )}

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800"
                aria-label="Search"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-700 dark:text-zinc-200"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </button>

              <Link
                href={user?.id ? `/users/${user.id}` : "/leaderboard"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset ring-zinc-200 bg-white dark:bg-zinc-950/40 dark:ring-zinc-800"
                aria-label="Profile"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
            {(
              [
                ["trending", "Trending"],
                ["new", "New"],
                ["following", "Following"],
                ["settling_soon", "Settling Soon"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
                  tab === key
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-4">
        {judgeMode && judgeOn && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Judge Mode</div>
              <button
                type="button"
                onClick={async () => {
                  if (!authToken) {
                    setToast("Verify in Alien (admin) to seed.");
                    window.setTimeout(() => setToast(null), 1500);
                    return;
                  }
                  try {
                    const res = await fetch("/api/dev/seed", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`,
                      },
                      body: JSON.stringify({
                        users: 8,
                        predictions: 14,
                        comments_per_prediction: 4,
                      }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok) throw new Error(data?.error || "seed failed");
                    setToast(
                      `Seeded ${data.created.predictions} preds, ${data.created.comments} comments.`
                    );
                    window.setTimeout(() => setToast(null), 1800);
                    await fetchPredictions();
                  } catch {
                    setToast("Seed failed (admin + JUDGE_MODE required).");
                    window.setTimeout(() => setToast(null), 1800);
                  }
                }}
                className="inline-flex items-center rounded-full bg-amber-900 px-3 py-1.5 text-[11px] font-semibold text-white dark:bg-amber-200 dark:text-amber-950"
              >
                Seed Demo
              </button>
            </div>
            <div className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-200/80">
              Creates sample predictions, stakes, votes, comments, and rep events.
            </div>
          </div>
        )}
        {sortedPredictions.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
            {tab === "following"
              ? "No posts from people you follow. Follow someone to curate your feed."
              : "No predictions yet. Post a call or follow someone."}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPredictions.map((pred) => (
              <PredictionCard
                key={pred.id}
                prediction={pred}
                commentsCount={pred.commentsCount ?? 0}
                authToken={authToken}
                currentUserId={user?.id ?? null}
                onRequireAuth={() => {
                  setToast("Verify in Alien to vote.");
                  window.setTimeout(() => setToast(null), 1800);
                }}
                onFollowChange={(creatorUserId, nextFollowing) => {
                  setPredictions((list) =>
                    list.map((p) =>
                      p.creatorUserId === creatorUserId
                        ? { ...p, creatorIsFollowed: nextFollowing }
                        : p
                    )
                  );
                }}
                onBet={() => {
                  setBetPrediction(pred);
                  setBetOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </main>

      <Link
        href="/create"
        className="fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-950"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
        aria-label="Create prediction"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          +
        </span>
        Create
      </Link>

      {toast && (
        <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 mx-auto max-w-2xl px-4">
          <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-950">
            {toast}
          </div>
        </div>
      )}

      <BetSheet
        open={betOpen}
        prediction={
          betPrediction
            ? {
                id: betPrediction.id,
                assetSymbol: betPrediction.assetSymbol,
                direction: betPrediction.direction,
                stakeSummary: betPrediction.stakeSummary,
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
          if (!betPrediction) return;
          const predictionId = betPrediction.id;
          const prev = predictions.find((p) => p.id === predictionId)?.stakeSummary ?? betPrediction.stakeSummary;
          betRollbackRef.current = () => {
            setPredictions((list) =>
              list.map((p) =>
                p.id === predictionId
                  ? {
                      ...p,
                      stakeSummary: prev,
                    }
                  : p
              )
            );
          };
          setPredictions((list) =>
            list.map((p) =>
              p.id === predictionId
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
            )
          );
        }}
        onOptimisticRollback={() => {
          betRollbackRef.current?.();
          betRollbackRef.current = null;
        }}
        onSuccess={({ stakeSummary }) => {
          setToast("Bet confirmed (demo).");
          window.setTimeout(() => setToast(null), 1800);
          betRollbackRef.current = null;
          if (!betPrediction) return;
          setPredictions((list) =>
            list.map((p) =>
              p.id === betPrediction.id
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
            )
          );
        }}
      />
    </div>
  );
}
