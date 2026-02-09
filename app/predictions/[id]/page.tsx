"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/MiniKitProvider";
import { useParams } from "next/navigation";
import Link from "next/link";

type Stake = {
  id: number;
  userId: number;
  side: "for" | "against";
  amount: string;
  currency: string;
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
  stakes: Stake[];
};

export default function PredictionPage() {
  const { id } = useParams<{ id: string }>();
  const { authToken } = useAuth();
  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrediction();
  }, [id]);

  async function fetchPrediction() {
    try {
      const res = await fetch(`/api/predictions/${id}`);
      if (!res.ok) {
        setError("Prediction not found");
        return;
      }
      const data = await res.json();
      setPrediction(data.prediction);
    } catch {
      setError("Failed to load prediction");
    } finally {
      setLoading(false);
    }
  }

  function formatWLD(baseUnits: string): string {
    const wld = Number(baseUnits) / 1e18;
    return wld.toFixed(2);
  }

  function formatDate(unix: number): string {
    return new Date(unix * 1000).toLocaleString();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-600 mb-4">{error || "Not found"}</p>
        <Link href="/" className="text-primary font-medium">Back to home</Link>
      </div>
    );
  }

  const isExpired = prediction.timeframeEnd * 1000 < Date.now();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-primary font-medium">Back</Link>
          <h1 className="text-xl font-bold">Prediction #{prediction.id}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Prediction Details */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-bold">{prediction.assetSymbol}</span>
            <span
              className={`badge ${
                prediction.direction === "up" ? "badge-success" : "badge-error"
              }`}
            >
              {prediction.direction === "up" ? "UP" : "DOWN"}
            </span>
            <span className="badge badge-warning">{prediction.status}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Confidence:</span>{" "}
              <span className="font-medium">{prediction.confidence}%</span>
            </div>
            <div>
              <span className="text-gray-600">Ends:</span>{" "}
              <span className={`font-medium ${isExpired ? "text-red-600" : ""}`}>
                {formatDate(prediction.timeframeEnd)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Created:</span>{" "}
              <span className="font-medium">
                {new Date(prediction.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>{" "}
              <span className="font-medium">{prediction.status}</span>
            </div>
          </div>

          {prediction.settlementPrice && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 text-sm">Settlement Price:</span>{" "}
              <span className="font-bold">${prediction.settlementPrice}</span>
            </div>
          )}
        </div>

        {/* Creator Reputation */}
        <div className="card">
          <h2 className="font-bold mb-3">Creator Reputation</h2>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Win Rate:</span>{" "}
              <span className="font-medium">{prediction.creatorReputation.winRate}%</span>
            </div>
            <div>
              <span className="text-gray-600">Settled:</span>{" "}
              <span className="font-medium">{prediction.creatorReputation.totalSettled}</span>
            </div>
            <div>
              <span className="text-gray-600">Score:</span>{" "}
              <span
                className={`font-medium ${
                  prediction.creatorReputation.score >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {prediction.creatorReputation.score > 0 ? "+" : ""}
                {prediction.creatorReputation.score}
              </span>
            </div>
          </div>
        </div>

        {/* Stake Summary */}
        <div className="card">
          <h2 className="font-bold mb-3">Stakes</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <div className="text-sm text-gray-600 mb-1">FOR (creator correct)</div>
              <div className="font-bold text-green-600 text-lg">
                {formatWLD(prediction.stakeSummary.totalFor)} WLD
              </div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <div className="text-sm text-gray-600 mb-1">AGAINST (creator wrong)</div>
              <div className="font-bold text-red-600 text-lg">
                {formatWLD(prediction.stakeSummary.totalAgainst)} WLD
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {prediction.stakeSummary.stakeCount} total stake
            {prediction.stakeSummary.stakeCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Individual Stakes */}
        {prediction.stakes.length > 0 && (
          <div className="card">
            <h2 className="font-bold mb-3">Stake History</h2>
            <div className="space-y-2">
              {prediction.stakes.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <span
                    className={`font-medium ${
                      s.side === "for" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {s.side.toUpperCase()}
                  </span>
                  <span className="font-medium">
                    {formatWLD(s.amount)} {s.currency}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
