"use client";

import { useState } from "react";
import { useAuth } from "@/components/MiniKitProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ASSETS = ["BTC", "ETH", "SOL", "WLD"];

export default function CreatePrediction() {
  const { isAuthenticated, authToken, isLoading } = useAuth();
  const router = useRouter();

  const [assetSymbol, setAssetSymbol] = useState("BTC");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [confidence, setConfidence] = useState(50);
  const [timeframeDays, setTimeframeDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authToken) return;

    setSubmitting(true);
    setError(null);

    const timeframeEnd = Math.floor(Date.now() / 1000) + timeframeDays * 86400;

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          asset_symbol: assetSymbol,
          direction,
          timeframe_end: timeframeEnd,
          confidence,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create prediction");
        return;
      }

      const data = await res.json();
      router.push(`/predictions/${data.prediction.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-600">Open this app inside Alien to create predictions.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-primary font-medium">Back</Link>
          <h1 className="text-xl font-bold">Create Prediction</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Asset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset</label>
            <div className="flex gap-2">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAssetSymbol(a)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    assetSymbol === a
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("up")}
                className={`flex-1 py-3 rounded-lg font-medium ${
                  direction === "up"
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                UP
              </button>
              <button
                type="button"
                onClick={() => setDirection("down")}
                className={`flex-1 py-3 rounded-lg font-medium ${
                  direction === "down"
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                DOWN
              </button>
            </div>
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence: {confidence}%
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Timeframe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
            <div className="flex gap-2">
              {[1, 3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTimeframeDays(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    timeframeDays === d
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full"
          >
            {submitting ? "Creating..." : `Predict ${assetSymbol} ${direction === "up" ? "UP" : "DOWN"}`}
          </button>
        </form>
      </main>
    </div>
  );
}
