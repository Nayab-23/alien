import crypto from "node:crypto";

// ─── Payment Configuration ──────────────────────────────────────────────────

export function getPaymentConfig() {
  const appId = process.env.ALIEN_APP_ID;
  const apiKey = process.env.ALIEN_API_KEY;

  if (!appId || !apiKey) {
    throw new Error(
      "Payment config incomplete: ALIEN_APP_ID and ALIEN_API_KEY required"
    );
  }

  return { appId, apiKey };
}

// ─── Webhook Signature Verification ─────────────────────────────────────────

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  const webhookSecret = process.env.ALIEN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("ALIEN_WEBHOOK_SECRET not configured");
  }

  // Verify timestamp is recent (within 5 minutes)
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return false;
  }

  // Verify HMAC signature
  const message = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac("sha256", webhookSecret);
  hmac.update(message);
  const expected = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ─── Reference ID Generation ────────────────────────────────────────────────

export function generatePaymentReference(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// ─── Token Amount Conversion ────────────────────────────────────────────────

export function toBaseUnits(amount: string, currency: "WLD" | "USDC"): string {
  const decimals = currency === "WLD" ? 18 : 6;
  const [whole, frac = ""] = amount.split(".");
  const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);
  return whole + paddedFrac;
}

export function fromBaseUnits(
  baseUnits: string,
  currency: "WLD" | "USDC"
): string {
  const decimals = currency === "WLD" ? 18 : 6;
  const padded = baseUnits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
