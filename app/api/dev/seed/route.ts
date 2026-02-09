import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  comments,
  follows,
  predictions,
  reputationEvents,
  stakes,
  users,
  votes,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

function judgeModeEnabled(): boolean {
  return process.env.JUDGE_MODE === "true";
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function nowPlusDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ─── POST /api/dev/seed ─────────────────────────────────────────────────────
// Dev-only seed for judge demos. JUDGE_MODE required.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!judgeModeEnabled()) {
    return Response.json({ error: "Judge mode disabled" }, { status: 404 });
  }

  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const seedUsers = Math.min(Math.max(Number(payload?.users ?? 6), 2), 30);
  const seedPredictions = Math.min(Math.max(Number(payload?.predictions ?? 10), 4), 80);
  const commentsPer = Math.min(Math.max(Number(payload?.comments_per_prediction ?? 4), 0), 30);

  const assets = ["BTC", "ETH", "SOL", "WLD"];

  try {
    // 1) Create fake users (alien_id prefixed so we can identify them later).
    const createdUsers: { id: number; alienId: string }[] = [];
    for (let i = 0; i < seedUsers; i++) {
      const alienId = `seed:user:${Date.now()}:${i}:${randInt(1000, 9999)}`;
      const inserted = await db.insert(users).values({ alienId }).returning();
      createdUsers.push({ id: inserted[0].id, alienId: inserted[0].alienId });
    }

    // 2) Follow graph: current user follows some seeded users so Following tab works.
    for (const u of createdUsers.slice(0, Math.min(4, createdUsers.length))) {
      await db
        .insert(follows)
        .values({ followerUserId: auth.user.id, followedUserId: u.id })
        .onConflictDoNothing();
    }

    // 3) Create predictions: mix of open + settled (so leaderboard has signal).
    const createdPreds: { id: number; creatorUserId: number; status: string }[] = [];
    for (let i = 0; i < seedPredictions; i++) {
      const creator = pick(createdUsers);
      const asset = pick(assets);
      const direction = Math.random() > 0.5 ? "up" : "down";
      const confidence = randInt(55, 92);

      const settled = i < Math.floor(seedPredictions * 0.5);
      const createdAt = new Date(Date.now() - randInt(2, 72) * 60 * 60 * 1000);
      const timeframeEnd = settled
        ? new Date(createdAt.getTime() + randInt(2, 24) * 60 * 60 * 1000)
        : nowPlusDays(randInt(1, 14));

      const inserted = await db
        .insert(predictions)
        .values({
          creatorUserId: creator.id,
          assetSymbol: asset,
          direction,
          timeframeEnd,
          confidence,
          status: settled ? "settled" : "open",
          settlementPrice: settled ? String(randInt(20, 120000)) : null,
          settlementTimestamp: settled ? new Date() : null,
          createdAt,
        })
        .returning();

      createdPreds.push({
        id: inserted[0].id,
        creatorUserId: inserted[0].creatorUserId,
        status: inserted[0].status,
      });
    }

    // 4) Add stakes + votes + comments.
    let stakesInserted = 0;
    let commentsInserted = 0;
    let votesInserted = 0;
    let repInserted = 0;

    for (const p of createdPreds) {
      // Stakes for open and settled predictions (so odds exist).
      const stakeCount = randInt(2, 8);
      for (let i = 0; i < stakeCount; i++) {
        const bettor = pick(createdUsers);
        const side = Math.random() > 0.5 ? "for" : "against";
        const amount = String(randInt(1, 20) * 1e18);
        await db
          .insert(stakes)
          .values({
            predictionId: p.id,
            userId: bettor.id,
            side,
            amount,
            currency: "DEMO",
            network: "demo",
            invoiceId: null,
            paymentStatus: "completed",
          })
          .onConflictDoNothing();
        stakesInserted++;
      }

      // Prediction votes
      const vCount = randInt(0, 8);
      for (let i = 0; i < vCount; i++) {
        const voter = pick(createdUsers);
        const value = pick([-1, 1] as const);
        await db
          .insert(votes)
          .values({ userId: voter.id, targetType: "prediction", targetId: p.id, value })
          .onConflictDoNothing();
        votesInserted++;
      }

      // Comments + comment upvotes
      for (let i = 0; i < commentsPer; i++) {
        const author = pick(createdUsers);
        const bodies = [
          "What is your thesis in one sentence?",
          "This feels mispriced. I’m taking the other side.",
          "Following. I’ve seen similar setups before.",
          "Source?",
          "Market is overreacting. I’m betting small.",
          "If this hits, I’m never letting you forget it.",
        ];
        const insertedC = await db
          .insert(comments)
          .values({
            predictionId: p.id,
            authorUserId: author.id,
            body: pick(bodies),
          })
          .returning();
        commentsInserted++;

        const upvotes = randInt(0, 6);
        for (let j = 0; j < upvotes; j++) {
          const voter = pick(createdUsers);
          await db
            .insert(votes)
            .values({
              userId: voter.id,
              targetType: "comment",
              targetId: insertedC[0].id,
              value: 1,
            })
            .onConflictDoNothing();
          votesInserted++;
        }
      }

      // Reputation events for settled predictions so leaderboard populates.
      if (p.status === "settled") {
        // Creator event (win/loss randomized)
        const creatorWon = Math.random() > 0.45;
        const creatorDelta = creatorWon ? randInt(10, 40) : -randInt(10, 40);
        await db
          .insert(reputationEvents)
          .values({
            userId: p.creatorUserId,
            predictionId: p.id,
            outcome: creatorWon ? "win" : "loss",
            deltaScore: creatorDelta,
          })
          .onConflictDoNothing();
        repInserted++;

        // A few staker events
        const sample = createdUsers.slice(0, Math.min(3, createdUsers.length));
        for (const u of sample) {
          const won = Math.random() > 0.5;
          const delta = won ? randInt(5, 25) : -randInt(5, 25);
          await db
            .insert(reputationEvents)
            .values({
              userId: u.id,
              predictionId: p.id,
              outcome: won ? "win" : "loss",
              deltaScore: delta,
            })
            .onConflictDoNothing();
          repInserted++;
        }
      }
    }

    // Quick sanity counts (optional)
    const predCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(predictions);

    return Response.json({
      ok: true,
      created: {
        users: createdUsers.length,
        predictions: createdPreds.length,
        stakes: stakesInserted,
        comments: commentsInserted,
        votes: votesInserted,
        reputationEvents: repInserted,
      },
      totals: {
        predictions: Number(predCount?.[0]?.count ?? 0),
      },
    });
  } catch (err) {
    console.error("Seed failed:", err);
    return Response.json({ error: "Seed failed" }, { status: 500 });
  }
}
