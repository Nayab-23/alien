"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/MiniKitProvider";
import Link from "next/link";

type Prediction = {
  id: number;
  assetSymbol: string;
  direction: "up" | "down";
  timeframeEnd: number;
  confidence: number;
  status: string;
  createdAt: string;
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
};

export default function Home() {
  const { isAuthenticated, user, isLoading, signIn } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
  }, []);

  async function fetchPredictions() {
    try {
      const res = await fetch("/api/predictions?limit=20");
      const data = await res.json();
      setPredictions(data.predictions);
    } catch (err) {
      console.error("Failed to fetch predictions:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatWLD(baseUnits: string): string {
    const wld = Number(baseUnits) / 1e18;
    return wld.toFixed(2);
  }

  function formatDate(unix: number): string {
    return new Date(unix * 1000).toLocaleDateString();
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-4">Signal Market</h1>
          <p className="text-gray-600 mb-6">
            Bet on price predictions with verified humans. Powered by World ID.
          </p>
          <button onClick={signIn} className="btn btn-primary w-full">
            Sign In with World ID
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Signal Market</h1>
          <div className="flex items-center gap-2">
            <span className="badge badge-success">✓ Verified Human</span>
            <Link href="/leaderboard" className="text-primary font-medium">
              Leaderboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Create CTA */}
        <Link
          href="/create"
          className="btn btn-primary w-full mb-6 text-center block"
        >
          + Create Prediction
        </Link>

        {/* Predictions List */}
        <div className="space-y-4">
          {predictions.length === 0 ? (
            <div className="card text-center text-gray-500">
              <p>No predictions yet. Be the first!</p>
            </div>
          ) : (
            predictions.map((pred) => (
              <Link
                key={pred.id}
                href={`/predictions/${pred.id}`}
                className="card block hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold">
                        {pred.assetSymbol}
                      </span>
                      <span
                        className={`badge ${
                          pred.direction === "up"
                            ? "badge-success"
                            : "badge-error"
                        }`}
                      >
                        {pred.direction === "up" ? "↑ UP" : "↓ DOWN"}
                      </span>
                      <span className="badge badge-warning">
                        {pred.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      by {formatDate(pred.timeframeEnd)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">
                      {pred.confidence}%
                    </div>
                    <div className="text-xs text-gray-500">confidence</div>
                  </div>
                </div>

                {/* Creator Reputation */}
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <div>
                    <span className="text-gray-600">Creator:</span>{" "}
                    <span className="font-medium">
                      {pred.creatorReputation.winRate.toFixed(0)}% win rate
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Score:</span>{" "}
                    <span
                      className={`font-medium ${
                        pred.creatorReputation.score >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {pred.creatorReputation.score > 0 ? "+" : ""}
                      {pred.creatorReputation.score}
                    </span>
                  </div>
                </div>

                {/* Stakes */}
                <div className="border-t border-gray-200 pt-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600 mb-1">FOR (creator correct)</div>
                      <div className="font-bold text-green-600">
                        {formatWLD(pred.stakeSummary.totalFor)} WLD
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">AGAINST (creator wrong)</div>
                      <div className="font-bold text-red-600">
                        {formatWLD(pred.stakeSummary.totalAgainst)} WLD
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {pred.stakeSummary.stakeCount} stake
                    {pred.stakeSummary.stakeCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
