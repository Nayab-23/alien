"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/MiniKitProvider";
import { PredictionCard, type FeedPrediction } from "@/components/PredictionCard";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

type ProfileStats = {
  winRate: number;
  settledPredictions: number;
  reputationScore: number;
  totalPredictions: number;
  wins: number;
  losses: number;
};

type UserProfileResponse = {
  user: { id: number; alienId: string; displayName: string };
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  stats: ProfileStats;
};

type UserPrediction = FeedPrediction & {
  settlementPrice?: string | null;
  settlementTimestamp?: number | null;
  outcome?: "win" | "loss" | "neutral" | null;
};

type UserComment = {
  id: number;
  predictionId: number;
  authorUserId: number;
  body: string;
  createdAt: string;
  score: number;
  userVote: 0 | 1;
};

function avatarBgFromId(id: number): string {
  const hues = [25, 190, 280, 140, 330, 210, 70];
  const hue = hues[id % hues.length];
  return `hsl(${hue} 70% 45%)`;
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const profileUserId = useMemo(() => parseInt(userId, 10), [userId]);
  const { authToken, user } = useAuth();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [predictions, setPredictions] = useState<UserPrediction[]>([]);
  const [userComments, setUserComments] = useState<UserComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"predictions" | "comments" | "track">("predictions");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authToken]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [pRes, prRes] = await Promise.all([
        fetch(`/api/users/${profileUserId}/profile`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        }),
        fetch(`/api/users/${profileUserId}/predictions?limit=50`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        }),
      ]);

      if (pRes.ok) setProfile(await pRes.json());
      if (prRes.ok) {
        const data = await prRes.json();
        setPredictions(data.predictions || []);
      }

      const cRes = await fetch(`/api/users/${profileUserId}/comments?limit=50`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (cRes.ok) {
        const data = await cRes.json();
        setUserComments(data.comments || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow() {
    if (!authToken || !profile) {
      setToast("Verify in Alien to follow.");
      window.setTimeout(() => setToast(null), 1800);
      return;
    }
    if (profile.user.id === user?.id) return;

    const next = !profile.isFollowing;
    setProfile((p) =>
      p
        ? {
            ...p,
            isFollowing: next,
            followerCount: Math.max(0, p.followerCount + (next ? 1 : -1)),
          }
        : p
    );

    try {
      const res = await fetch(`/api/follow/${profile.user.id}`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("follow failed");
      const data = await res.json();
      setProfile((p) => (p ? { ...p, isFollowing: data.following, followerCount: data.followerCount } : p));
    } catch {
      setProfile((p) => (p ? { ...p, isFollowing: !next } : p));
    }
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 rounded-lg" />
              <div className="mt-2">
                <Skeleton className="h-3 w-28 rounded-lg" />
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="pt-1">
                  <Skeleton className="h-5 w-40 rounded-lg" />
                  <div className="mt-2">
                    <Skeleton className="h-3 w-32 rounded-lg" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-10 w-24 rounded-2xl" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          </div>
          <div className="mt-6">
            <SkeletonText lines={3} />
          </div>
        </div>
      </div>
    );
  }

  const isMe = profile.user.id === user?.id;
  const settled = predictions.filter((p) => p.status === "settled");

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
            <div className="truncate text-sm font-extrabold tracking-tight">{profile.user.displayName}</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {profile.followerCount} followers · {profile.followingCount} following
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="h-14 w-14 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                style={{ background: avatarBgFromId(profile.user.id) }}
                aria-hidden="true"
              />
              <div>
                <div className="text-lg font-extrabold tracking-tight">{profile.user.displayName}</div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Verified predictor · ID {profile.user.id}
                </div>
              </div>
            </div>

            {!isMe && (
              <button
                type="button"
                onClick={() => void toggleFollow()}
                className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${
                  profile.isFollowing
                    ? "bg-zinc-100 text-zinc-900 ring-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-800"
                    : "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                }`}
              >
                {profile.isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
              <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Win rate</div>
              <div className="mt-1 text-lg font-extrabold">{profile.stats.winRate}%</div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
              <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Settled</div>
              <div className="mt-1 text-lg font-extrabold">{profile.stats.settledPredictions}</div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
              <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Rep score</div>
              <div className="mt-1 text-lg font-extrabold">{profile.stats.reputationScore}</div>
            </div>
          </div>
        </section>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {(
            [
              ["predictions", "Predictions"],
              ["comments", "Comments"],
              ["track", "Track Record"],
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

        <div className="mt-4">
          {tab === "comments" ? (
            userComments.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                No comments yet.
              </div>
            ) : (
              <div className="space-y-3">
                {userComments.map((c) => (
                  <Link
                    key={c.id}
                    href={`/predictions/${c.predictionId}`}
                    className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        Commented on Prediction #{c.predictionId}
                      </div>
                      <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        ▲ {c.score}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-zinc-900 dark:text-zinc-50 whitespace-pre-wrap">
                      {c.body}
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : tab === "track" ? (
            settled.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                No settled predictions yet.
              </div>
            ) : (
              <div className="space-y-3">
                {settled.map((p) => (
                  <Link
                    key={p.id}
                    href={`/predictions/${p.id}`}
                    className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-extrabold tracking-tight">
                        {p.assetSymbol} {p.direction === "up" ? "UP" : "DOWN"}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                          p.outcome === "win"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900"
                            : p.outcome === "loss"
                              ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800"
                        }`}
                      >
                        {p.outcome === "win" ? "WIN" : p.outcome === "loss" ? "LOSS" : "SETTLED"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Settled {p.settlementTimestamp ? new Date(p.settlementTimestamp * 1000).toLocaleString() : ""}
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : predictions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
              No predictions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {predictions.map((p) => (
                <PredictionCard
                  key={p.id}
                  prediction={{
                    ...p,
                    creatorIsFollowed: profile.isFollowing,
                  }}
                  commentsCount={0}
                  authToken={authToken}
                  currentUserId={user?.id ?? null}
                  onRequireAuth={() => {
                    setToast("Verify in Alien to follow/vote.");
                    window.setTimeout(() => setToast(null), 1800);
                  }}
                />
              ))}
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
