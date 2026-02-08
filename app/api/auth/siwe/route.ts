import {
  verifySiweMessage,
  type MiniAppWalletAuthSuccessPayload,
} from "@worldcoin/minikit-js";
import { consumeNonce, resolveUser, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { payload: MiniAppWalletAuthSuccessPayload; nonce: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { payload, nonce: clientNonce } = body;

  if (!payload?.message || !payload?.signature || !payload?.address) {
    return Response.json(
      { error: "Missing payload fields (message, signature, address)" },
      { status: 400 }
    );
  }

  // ── 1. Verify nonce matches the signed cookie ─────────────────────────
  const storedNonce = await consumeNonce();

  if (!storedNonce) {
    return Response.json(
      { error: "Nonce expired or missing — call GET /api/nonce first" },
      { status: 401 }
    );
  }

  if (clientNonce !== storedNonce) {
    return Response.json({ error: "Nonce mismatch" }, { status: 401 });
  }

  // ── 2. Verify SIWE signature via MiniKit ──────────────────────────────
  try {
    const { isValid, siweMessageData } = await verifySiweMessage(
      payload,
      storedNonce
    );

    if (!isValid) {
      return Response.json(
        { error: "Invalid SIWE signature" },
        { status: 401 }
      );
    }

    // ── 3. Derive stable identity ─────────────────────────────────────
    // The address from the SIWE payload is the user's Safe wallet on
    // World Chain — tied to their World ID, stable across sessions.
    const alienSubject = (
      siweMessageData.address ?? payload.address
    ).toLowerCase();

    // ── 4. Resolve/create user row ────────────────────────────────────
    const user = resolveUser(alienSubject);

    // ── 5. Create session cookie ──────────────────────────────────────
    await createSession(alienSubject);

    return Response.json({
      status: "success",
      user: {
        id: user.id,
        alienSubject: user.alienSubject,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Signature verification failed";
    return Response.json({ error: message }, { status: 401 });
  }
}
