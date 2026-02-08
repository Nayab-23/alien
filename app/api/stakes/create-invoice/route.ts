import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stakes, predictions } from "@/lib/db/schema";
import {
  validateStakeInput,
  ValidationError,
} from "@/lib/validation";
import {
  generatePaymentReference,
  toBaseUnits,
  getPaymentConfig,
} from "@/lib/payments";
import { eq } from "drizzle-orm";

// ─── POST /api/stakes/create-invoice ────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth required
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // 2. Validate input
  let input;
  try {
    const body = await request.json();
    input = validateStakeInput(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 3. Check prediction exists and is open
  try {
    const prediction = db
      .select()
      .from(predictions)
      .where(eq(predictions.id, input.predictionId))
      .get();

    if (!prediction) {
      return Response.json(
        { error: "Prediction not found" },
        { status: 404 }
      );
    }

    if (prediction.status !== "open") {
      return Response.json(
        { error: "Prediction is not open for staking" },
        { status: 400 }
      );
    }

    // Check if prediction has expired
    const now = new Date();
    if (prediction.timeframeEnd < now) {
      return Response.json(
        { error: "Prediction timeframe has expired" },
        { status: 400 }
      );
    }

    // 4. Generate payment reference
    const reference = generatePaymentReference();
    const { recipientAddress } = getPaymentConfig();

    // 5. Convert amount to base units
    const amountInBaseUnits = toBaseUnits(input.amount, input.currency);

    // 6. Create pending stake
    const stake = db
      .insert(stakes)
      .values({
        predictionId: input.predictionId,
        userId: auth.user.id,
        side: input.side,
        amount: amountInBaseUnits,
        currency: input.currency,
        invoiceId: reference,
        paymentStatus: "initiated",
      })
      .returning()
      .get();

    // 7. Return invoice details for frontend to call MiniKit Pay
    return Response.json(
      {
        stake: {
          id: stake.id,
          reference,
          predictionId: input.predictionId,
          side: input.side,
          amount: input.amount,
          currency: input.currency,
        },
        payment: {
          reference,
          to: recipientAddress,
          tokens: [
            {
              symbol: input.currency,
              token_amount: amountInBaseUnits,
            },
          ],
          description: `Stake ${input.amount} ${input.currency} ${input.side} prediction #${input.predictionId}`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create stake invoice:", err);
    return Response.json(
      { error: "Failed to create stake invoice" },
      { status: 500 }
    );
  }
}
