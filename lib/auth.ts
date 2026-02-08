import { cookies } from "next/headers";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SessionUser = {
  id: number;
  alienSubject: string;
  createdAt: Date;
};

// ─── Nonce helpers ──────────────────────────────────────────────────────────
// Nonces are HMAC-signed so they can't be forged client-side.

const NONCE_COOKIE = "siwe_nonce";
const SESSION_COOKIE = "session";

function getNonceSecret(): string {
  const secret = process.env.NONCE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("NONCE_SECRET env var must be set (min 16 chars)");
  }
  return secret;
}

function signNonce(nonce: string): string {
  return crypto
    .createHmac("sha256", getNonceSecret())
    .update(nonce)
    .digest("hex");
}

/** Generate a nonce, store it in an httpOnly cookie, return the raw value. */
export async function createNonce(): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const signature = signNonce(nonce);
  const cookieStore = await cookies();
  cookieStore.set(NONCE_COOKIE, `${nonce}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return nonce;
}

/** Read and verify the nonce cookie. Returns the raw nonce or null. */
export async function consumeNonce(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(NONCE_COOKIE)?.value;
  if (!raw) return null;

  const dotIdx = raw.indexOf(".");
  if (dotIdx === -1) return null;

  const nonce = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);

  if (signNonce(nonce) !== sig) return null;

  // One-time use: delete after reading
  cookieStore.delete(NONCE_COOKIE);
  return nonce;
}

// ─── Session helpers ────────────────────────────────────────────────────────
// Session cookie stores the alien_subject (wallet address).
// Signed with HMAC to prevent tampering.

function signSession(subject: string): string {
  return crypto
    .createHmac("sha256", getNonceSecret())
    .update(subject)
    .digest("hex");
}

export async function createSession(alienSubject: string): Promise<void> {
  const sig = signSession(alienSubject);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${alienSubject}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 86400 * 7, // 7 days
  });
}

/** Read session cookie and return the alien_subject, or null if invalid. */
export async function readSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const dotIdx = raw.indexOf(".");
  if (dotIdx === -1) return null;

  const subject = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);

  if (signSession(subject) !== sig) return null;
  return subject;
}

// ─── User resolution ────────────────────────────────────────────────────────

/** Find or create a user row from alien_subject. Returns the full user. */
export function resolveUser(alienSubject: string): SessionUser {
  // Upsert: insert if not exists, then select
  db.insert(users)
    .values({ alienSubject })
    .onConflictDoNothing({ target: users.alienSubject })
    .run();

  const row = db
    .select()
    .from(users)
    .where(eq(users.alienSubject, alienSubject))
    .get();

  if (!row) {
    throw new Error("Failed to resolve user after upsert");
  }

  return {
    id: row.id,
    alienSubject: row.alienSubject,
    createdAt: row.createdAt,
  };
}

// ─── Auth middleware ─────────────────────────────────────────────────────────

/**
 * Verify the session and resolve the user.
 * Returns the user or null (caller decides whether to 401).
 */
export async function authenticate(): Promise<SessionUser | null> {
  const subject = await readSession();
  if (!subject) return null;
  try {
    return resolveUser(subject);
  } catch {
    return null;
  }
}

/**
 * Same as authenticate() but throws-friendly for route handlers:
 * returns { user } or { error: Response }.
 */
export async function requireAuth(): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: Response }
> {
  const user = await authenticate();
  if (!user) {
    return {
      error: Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { user };
}
