"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

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
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/leaderboard?limit=50");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
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
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
            No reputation data yet. Settle a few predictions to seed rankings.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.userId}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 flex items-center gap-4"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-white ${
                    entry.rank <= 3 ? "bg-amber-500" : "bg-zinc-400"
                  }`}
                >
                  {entry.rank}
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                    <Link href={`/users/${entry.userId}`} className="hover:underline">
                      @signal{entry.userId}
                    </Link>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.wins}W / {entry.losses}L ({entry.winRate}% win rate)
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-bold ${
                      entry.reputationScore >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {entry.reputationScore > 0 ? "+" : ""}
                    {entry.reputationScore}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.settledPredictions} settled
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
