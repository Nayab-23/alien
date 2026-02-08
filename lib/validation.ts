import {
  predictionDirection,
  stakeSide,
  type PredictionDirection,
  type StakeSide,
} from "@/lib/db/schema";

// ─── Validation Errors ──────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ─── Prediction Input ───────────────────────────────────────────────────────

export type CreatePredictionInput = {
  assetSymbol: string;
  direction: PredictionDirection;
  timeframeEnd: number; // Unix timestamp (seconds)
  confidence: number; // 1-100
};

export function validatePredictionInput(
  body: unknown
): CreatePredictionInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object");
  }

  const input = body as Record<string, unknown>;

  // asset_symbol
  if (typeof input.asset_symbol !== "string" || input.asset_symbol.length === 0) {
    throw new ValidationError("asset_symbol must be a non-empty string");
  }
  if (!/^[A-Z0-9]{1,10}$/.test(input.asset_symbol)) {
    throw new ValidationError(
      "asset_symbol must be 1-10 uppercase alphanumeric chars (e.g. ETH, BTC)"
    );
  }

  // direction
  if (
    typeof input.direction !== "string" ||
    !predictionDirection.includes(input.direction as PredictionDirection)
  ) {
    throw new ValidationError('direction must be "up" or "down"');
  }

  // timeframe_end
  if (typeof input.timeframe_end !== "number") {
    throw new ValidationError("timeframe_end must be a number (unix timestamp)");
  }
  const now = Math.floor(Date.now() / 1000);
  if (input.timeframe_end <= now) {
    throw new ValidationError(
      "timeframe_end must be in the future (unix timestamp)"
    );
  }
  if (input.timeframe_end > now + 365 * 86400) {
    throw new ValidationError("timeframe_end cannot be more than 1 year in the future");
  }

  // confidence
  if (typeof input.confidence !== "number") {
    throw new ValidationError("confidence must be a number");
  }
  if (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 100) {
    throw new ValidationError("confidence must be an integer between 1 and 100");
  }

  return {
    assetSymbol: input.asset_symbol,
    direction: input.direction as PredictionDirection,
    timeframeEnd: input.timeframe_end,
    confidence: input.confidence,
  };
}

// ─── Stake Input ────────────────────────────────────────────────────────────

export type CreateStakeInput = {
  predictionId: number;
  side: StakeSide;
  amount: string; // Human-readable amount (e.g. "10.5")
  currency: "WLD" | "USDC";
};

export function validateStakeInput(body: unknown): CreateStakeInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object");
  }

  const input = body as Record<string, unknown>;

  // prediction_id
  if (typeof input.prediction_id !== "number" || !Number.isInteger(input.prediction_id)) {
    throw new ValidationError("prediction_id must be an integer");
  }

  // side
  if (
    typeof input.side !== "string" ||
    !stakeSide.includes(input.side as StakeSide)
  ) {
    throw new ValidationError('side must be "for" or "against"');
  }

  // amount
  if (typeof input.amount !== "string") {
    throw new ValidationError("amount must be a string");
  }
  const amountNum = parseFloat(input.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new ValidationError("amount must be a positive number");
  }
  // Minimum $0.1 equivalent (MiniKit requirement)
  if (amountNum < 0.1) {
    throw new ValidationError("amount must be at least 0.1 (MiniKit minimum)");
  }

  // currency
  if (input.currency !== "WLD" && input.currency !== "USDC") {
    throw new ValidationError('currency must be "WLD" or "USDC"');
  }

  return {
    predictionId: input.prediction_id,
    side: input.side as StakeSide,
    amount: input.amount,
    currency: input.currency,
  };
}
