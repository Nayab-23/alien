"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-primary font-medium">Back</Link>
          <h1 className="text-xl font-bold">Leaderboard</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {entries.length === 0 ? (
          <div className="card text-center text-gray-500">
            <p>No reputation data yet. Make some predictions!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.userId}
                className="card flex items-center gap-4"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    entry.rank <= 3 ? "bg-yellow-500" : "bg-gray-400"
                  }`}
                >
                  {entry.rank}
                </div>

                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {entry.alienId.slice(0, 8)}...{entry.alienId.slice(-4)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {entry.wins}W / {entry.losses}L ({entry.winRate}% win rate)
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-bold ${
                      entry.reputationScore >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {entry.reputationScore > 0 ? "+" : ""}
                    {entry.reputationScore}
                  </div>
                  <div className="text-xs text-gray-500">
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
