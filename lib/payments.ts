import crypto from "node:crypto";

// ─── Payment Configuration ──────────────────────────────────────────────────

export function getPaymentConfig() {
  const appId = process.env.APP_ID;
  const apiKey = process.env.DEV_PORTAL_API_KEY;
  const recipientAddress = process.env.RECIPIENT_ADDRESS;

  if (!appId || !apiKey || !recipientAddress) {
    throw new Error(
      "Payment config incomplete: APP_ID, DEV_PORTAL_API_KEY, and RECIPIENT_ADDRESS required"
    );
  }

  return { appId, apiKey, recipientAddress };
}

// ─── Transaction Status Polling ─────────────────────────────────────────────

export type TransactionStatus = "pending" | "mined" | "failed";

export type TransactionDetails = {
  status: TransactionStatus;
  transactionHash?: string;
  reference: string;
  to: string;
  amount: string;
  currency: string;
};

/**
 * Query transaction status from Developer Portal API.
 * https://developer.worldcoin.org/api/v2/minikit/transaction/{transaction_id}
 */
export async function pollTransactionStatus(
  transactionId: string
): Promise<TransactionDetails | null> {
  const { appId, apiKey } = getPaymentConfig();

  const url = `https://developer.worldcoin.org/api/v2/minikit/transaction/${transactionId}?app_id=${appId}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to poll transaction ${transactionId}: ${response.status}`
      );
      return null;
    }

    const data = await response.json();

    // Map status
    let status: TransactionStatus = "pending";
    if (data.status === "mined") {
      status = "mined";
    } else if (data.status === "failed") {
      status = "failed";
    }

    return {
      status,
      transactionHash: data.transaction_hash,
      reference: data.reference,
      to: data.to,
      amount: data.tokens?.[0]?.token_amount ?? "0",
      currency: data.tokens?.[0]?.symbol ?? "UNKNOWN",
    };
  } catch (err) {
    console.error(`Error polling transaction ${transactionId}:`, err);
    return null;
  }
}

// ─── Reference ID Generation ────────────────────────────────────────────────

/**
 * Generate a unique payment reference (no hyphens, as required by MiniKit).
 */
export function generatePaymentReference(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// ─── Token Amount Conversion ────────────────────────────────────────────────

/**
 * Convert human-readable token amount to base units.
 * WLD has 18 decimals, USDC has 6 decimals.
 */
export function toBaseUnits(amount: string, currency: "WLD" | "USDC"): string {
  const decimals = currency === "WLD" ? 18 : 6;
  const [whole, frac = ""] = amount.split(".");
  const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);
  return whole + paddedFrac;
}

/**
 * Convert base units to human-readable amount.
 */
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
