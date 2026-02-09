"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/components/MiniKitProvider";
import { dataClient } from "@/lib/data/dataClient";

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

type Summary = {
  totalPredictors: number;
  totalSettledPredictions: number;
  period: string;
  scope: string;
};

export default function LeaderboardPage() {
  const { authToken } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "week" | "following">("all");
  const demoMode = dataClient.demoMode();
  const judgeMode =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_JUDGE_MODE === "true";
  const [toast, setToast] = useState<string | null>(null);
  const [judgeOn, setJudgeOn] = useState(false);

  useEffect(() => {
    if (!judgeMode) return;
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("anchorsignal_judge_mode")
        : null;
    setJudgeOn(stored === "true");
  }, [judgeMode]);

  useEffect(() => {
    fetchLeaderboard();
  }, [filter, authToken]);

  async function fetchLeaderboard() {
    try {
      const period = filter === "week" ? "week" : "all";
      const scope = filter === "following" ? "following" : "all";
      const data = await dataClient.listLeaderboard({
        limit: 50,
        period,
        scope,
        authToken,
      });
      setSummary(data.summary || null);
      setEntries(data.leaderboard || []);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }

  function avatarBgFromId(id: number): string {
    const hues = [25, 190, 280, 140, 330, 210, 70];
    const hue = hues[id % hues.length];
    return `hsl(${hue} 70% 45%)`;
  }

  function streakLabel(streak: number): { text: string; tone: string } {
    if (!streak) {
      return {
        text: "—",
        tone: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800",
      };
    }
    if (streak > 0) {
      return {
        text: `W${streak}`,
        tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900",
      };
    }
    return {
      text: `L${Math.abs(streak)}`,
      tone: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900",
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <Skeleton className="h-6 w-36 rounded-xl" />
          <div className="mt-6 space-y-3 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-44 rounded-lg" />
                    <div className="mt-2">
                      <Skeleton className="h-3 w-32 rounded-lg" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-14 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="max-w-2xl mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800"
            aria-label="Back"
          >
            <span className="text-lg">←</span>
          </Link>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">Leaderboard</h1>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Credibility is earned over settled calls
            </div>
          </div>
          {demoMode ? (
            <div className="ml-auto inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800">
              Demo Mode
            </div>
          ) : judgeMode && judgeOn ? (
            <div className="ml-auto inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800">
              Demo
            </div>
          ) : null}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                Stats
              </div>
              <div className="mt-1 text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                {summary?.totalPredictors ?? entries.length} predictors
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                Settled
              </div>
              <div className="mt-1 text-sm font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                {summary?.totalSettledPredictions ??
                  entries.reduce((s, e) => s + e.settledPredictions, 0)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
            {(
              [
                ["all", "All"],
                ["week", "This Week"],
                ["following", "Following"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === "following" && !authToken) {
                    setToast("Verify in Alien to view Following rankings.");
                    window.setTimeout(() => setToast(null), 1800);
                    return;
                  }
                  setLoading(true);
                  setFilter(key);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
                  filter === key
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-4">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
              <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                No scores yet
              </div>
              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Settle predictions to unlock rankings.
              </div>
              {judgeMode && !demoMode && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!authToken) {
                      setToast("Verify in Alien (admin) to seed demo data.");
                      window.setTimeout(() => setToast(null), 1800);
                      return;
                    }
                    try {
                      const res = await fetch("/api/dev/seed", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({ users: 8, predictions: 12, comments_per_prediction: 3 }),
                      });
                      const data = await res.json().catch(() => null);
                      if (!res.ok) throw new Error(data?.error || "seed failed");
                      setToast("Demo seeded. Refreshing leaderboard...");
                      window.setTimeout(() => setToast(null), 1800);
                      setLoading(true);
                      await fetchLeaderboard();
                    } catch {
                      setToast("Seed failed (admin + JUDGE_MODE required).");
                      window.setTimeout(() => setToast(null), 1800);
                    }
                  }}
                  className="mt-4 inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
                >
                  Seed demo
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-950/30 border-b border-zinc-200 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Top predictors
                </div>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {entries.map((entry) => {
                  const st = streakLabel(entry.streak);
                  return (
                    <div key={entry.userId} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 text-center text-sm font-extrabold tabular-nums text-zinc-500 dark:text-zinc-400">
                        {entry.rank}
                      </div>
                      <div
                        className="h-10 w-10 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                        style={{ background: avatarBgFromId(entry.userId) }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/users/${entry.userId}`}
                            className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50 hover:underline"
                          >
                            @signal{entry.userId}
                          </Link>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${st.tone}`}
                          >
                            {st.text}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {entry.winRate}% win rate · {entry.settledPredictions} settled
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-extrabold tabular-nums ${
                            entry.reputationScore >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {entry.reputationScore > 0 ? "+" : ""}
                          {entry.reputationScore}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {entry.wins}W · {entry.losses}L
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 mx-auto max-w-2xl px-4">
          <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-950">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
