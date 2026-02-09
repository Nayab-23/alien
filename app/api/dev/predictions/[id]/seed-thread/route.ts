import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, stakes, users, votes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function judgeModeEnabled(): boolean {
  return process.env.JUDGE_MODE === "true";
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

async function ensureSeedUsers(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const alienId = `seed:thread:${i}`;
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.alienId, alienId))
      .limit(1);
    if (existing.length > 0) {
      ids.push(existing[0].id);
      continue;
    }
    const inserted = await db.insert(users).values({ alienId }).returning();
    ids.push(inserted[0].id);
  }
  return ids;
}

// ─── POST /api/dev/predictions/:id/seed-thread ──────────────────────────────
// Dev-only: adds comments + demo stakes + votes to make a thread feel alive.
// Requires JUDGE_MODE and auth (no admin needed).
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!judgeModeEnabled()) {
    return Response.json({ error: "Judge mode disabled" }, { status: 404 });
  }

  const { id } = await context.params;
  const predictionId = parseInt(id, 10);
  if (!Number.isFinite(predictionId) || predictionId <= 0) {
    return Response.json({ error: "Invalid prediction ID" }, { status: 400 });
  }

  try {
    const seedUserIds = await ensureSeedUsers(5);
    const bodies = [
      "What’s the thesis here?",
      "I’m fading this. Market looks one-sided.",
      "Any source link?",
      "Sizing small but I’m in.",
      "This is either genius or cope.",
      "Interesting. Watching liquidity build.",
    ];

    // Add a few demo stakes so totals/activity look market-like.
    const stakePairs = new Set<string>();
    const stakeCount = randInt(2, 5);
    for (let i = 0; i < stakeCount; i++) {
      const userId = pick(seedUserIds);
      const side = Math.random() > 0.5 ? "for" : "against";
      const key = `${userId}:${side}`;
      if (stakePairs.has(key)) continue;
      stakePairs.add(key);
      const amount = String(randInt(1, 15) * 1e18);
      await db
        .insert(stakes)
        .values({
          predictionId,
          userId,
          side,
          amount,
          currency: "DEMO",
          network: "demo",
          invoiceId: null,
          paymentStatus: "completed",
        })
        .onConflictDoNothing();
    }

    // Add comments + some upvotes.
    const commentCount = randInt(3, 6);
    for (let i = 0; i < commentCount; i++) {
      const authorUserId = pick(seedUserIds);
      const inserted = await db
        .insert(comments)
        .values({
          predictionId,
          authorUserId,
          body: pick(bodies),
        })
        .returning();

      // Upvote a subset of comments
      const upvotes = randInt(0, 4);
      for (let j = 0; j < upvotes; j++) {
        const voterUserId = pick(seedUserIds);
        await db
          .insert(votes)
          .values({
            userId: voterUserId,
            targetType: "comment",
            targetId: inserted[0].id,
            value: 1,
          })
          .onConflictDoNothing();
      }
    }

    // Give the prediction a bit of social score, too.
    for (const u of seedUserIds) {
      const value = Math.random() > 0.5 ? 1 : -1;
      await db
        .insert(votes)
        .values({
          userId: u,
          targetType: "prediction",
          targetId: predictionId,
          value,
        })
        .onConflictDoNothing();
    }

    // Also ensure the current user has at least one interaction opportunity.
    await db
      .insert(votes)
      .values({
        userId: auth.user.id,
        targetType: "prediction",
        targetId: predictionId,
        value: 1,
      })
      .onConflictDoNothing();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Seed thread failed:", err);
    return Response.json({ error: "Seed thread failed" }, { status: 500 });
  }
}
