import { db } from "@/lib/db";
import { stakes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/payments";

// ─── POST /api/webhooks/payment ─────────────────────────────────────────────
// Receives payment notifications from Alien platform.
// Verifies webhook signature before processing.

export async function POST(request: Request) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  // Verify webhook signature
  const signature = request.headers.get("x-alien-signature") || "";
  const timestamp = request.headers.get("x-alien-timestamp") || "";

  if (signature && timestamp) {
    try {
      const valid = await verifyWebhookSignature(rawBody, signature, timestamp);
      if (!valid) {
        console.error("[Webhook] Invalid signature");
        return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch (err) {
      console.error("[Webhook] Signature verification error:", err);
      return Response.json({ error: "Signature verification failed" }, { status: 500 });
    }
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transaction_id, reference, status: txStatus } = body;

  if (!transaction_id || !reference) {
    return Response.json(
      { error: "Missing transaction_id or reference" },
      { status: 400 }
    );
  }

  console.log(
    `[Webhook] Received payment notification: tx=${transaction_id}, ref=${reference}, status=${txStatus}`
  );

  try {
    // 1. Find pending stake by reference (invoice_id)
    const stakeRows = await db
      .select()
      .from(stakes)
      .where(eq(stakes.invoiceId, reference))
      .limit(1);

    if (stakeRows.length === 0) {
      console.warn(`[Webhook] No stake found for reference ${reference}`);
      return Response.json({ error: "Stake not found" }, { status: 404 });
    }

    const stake = stakeRows[0];

    // 2. Idempotency: if already completed, skip
    if (stake.paymentStatus === "completed") {
      console.log(
        `[Webhook] Stake ${stake.id} already completed, skipping`
      );
      return Response.json({
        status: "ok",
        message: "Already completed",
      });
    }

    // 3. Update stake status based on transaction status
    let newStatus: "pending" | "completed" | "failed" = "pending";
    if (txStatus === "completed" || txStatus === "mined") {
      newStatus = "completed";
    } else if (txStatus === "failed") {
      newStatus = "failed";
    }

    await db
      .update(stakes)
      .set({ paymentStatus: newStatus })
      .where(eq(stakes.id, stake.id));

    console.log(
      `[Webhook] Updated stake ${stake.id} to status=${newStatus}`
    );

    return Response.json({
      status: "ok",
      stake_id: stake.id,
      payment_status: newStatus,
    });
  } catch (err) {
    console.error("[Webhook] Error processing payment:", err);
    return Response.json(
      { error: "Failed to process payment" },
      { status: 500 }
    );
  }
}
