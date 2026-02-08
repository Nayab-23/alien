import { db } from "@/lib/db";
import { stakes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pollTransactionStatus } from "@/lib/payments";

// ─── POST /api/webhooks/payment ─────────────────────────────────────────────
// Receives payment notifications from World Developer Portal.
// NOTE: World/MiniKit does NOT send webhook notifications automatically.
// Instead, the backend must poll the transaction status using the
// Developer Portal API after receiving the transaction_id from the frontend.

export async function POST(request: Request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transaction_id, reference } = body;

  if (!transaction_id || !reference) {
    return Response.json(
      { error: "Missing transaction_id or reference" },
      { status: 400 }
    );
  }

  console.log(
    `[Webhook] Received payment notification: tx=${transaction_id}, ref=${reference}`
  );

  try {
    // 1. Find pending stake by reference (invoice_id)
    const stake = db
      .select()
      .from(stakes)
      .where(eq(stakes.invoiceId, reference))
      .get();

    if (!stake) {
      console.warn(`[Webhook] No stake found for reference ${reference}`);
      return Response.json({ error: "Stake not found" }, { status: 404 });
    }

    // 2. Idempotency: if already confirmed, skip
    if (stake.paymentStatus === "confirmed") {
      console.log(
        `[Webhook] Stake ${stake.id} already confirmed, skipping`
      );
      return Response.json({
        status: "ok",
        message: "Already confirmed",
      });
    }

    // 3. Poll transaction status from Developer Portal
    const txDetails = await pollTransactionStatus(transaction_id);

    if (!txDetails) {
      console.error(
        `[Webhook] Failed to poll transaction ${transaction_id}`
      );
      return Response.json(
        { error: "Failed to verify transaction" },
        { status: 500 }
      );
    }

    // 4. Verify reference matches
    if (txDetails.reference !== reference) {
      console.error(
        `[Webhook] Reference mismatch: expected ${reference}, got ${txDetails.reference}`
      );
      return Response.json(
        { error: "Reference mismatch" },
        { status: 400 }
      );
    }

    // 5. Update stake status based on transaction status
    let newStatus: "confirmed" | "failed" | "initiated" = "initiated";
    if (txDetails.status === "mined") {
      newStatus = "confirmed";
    } else if (txDetails.status === "failed") {
      newStatus = "failed";
    }

    db.update(stakes)
      .set({ paymentStatus: newStatus })
      .where(eq(stakes.id, stake.id))
      .run();

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
