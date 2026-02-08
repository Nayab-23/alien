import crypto from "node:crypto";

/**
 * Verify that an incoming webhook request was signed by the Alien
 * (World/Developer Portal) backend using HMAC-SHA256.
 *
 * Expected header: Authorization: Bearer <hex-signature>
 * Signature = HMAC-SHA256(DEV_PORTAL_API_KEY, rawBody)
 *
 * Call this in webhook route handlers INSTEAD of requireAuth().
 */
export async function verifyWebhookSignature(
  request: Request
): Promise<
  | { valid: true; body: string }
  | { valid: false; error: Response }
> {
  const secret = process.env.DEV_PORTAL_API_KEY;
  if (!secret) {
    console.error("DEV_PORTAL_API_KEY not configured");
    return {
      valid: false,
      error: Response.json(
        { error: "Webhook verification not configured" },
        { status: 500 }
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      valid: false,
      error: Response.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      ),
    };
  }

  const providedSig = authHeader.slice(7); // strip "Bearer "
  const body = await request.text();

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const sigBuffer = Buffer.from(providedSig, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return {
      valid: false,
      error: Response.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      ),
    };
  }

  return { valid: true, body };
}
