import { createAuthClient, type AuthClient } from "@alien_org/auth-client";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SessionUser = {
  id: number;
  alienId: string;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Auth Client (singleton) ────────────────────────────────────────────────

let authClient: AuthClient | null = null;

function getAuthClient(): AuthClient {
  if (!authClient) {
    authClient = createAuthClient({
      jwksUrl: process.env.ALIEN_JWKS_URL || "https://sso.alien-api.com/oauth/jwks",
    });
  }
  return authClient;
}

// ─── Token Helpers ──────────────────────────────────────────────────────────

export function extractBearerToken(header: string | null): string | null {
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function verifyToken(accessToken: string) {
  return getAuthClient().verifyToken(accessToken);
}

// ─── User Resolution ────────────────────────────────────────────────────────

export async function findOrCreateUser(alienId: string): Promise<SessionUser> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.alienId, alienId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.alienId, alienId));

    return {
      id: existing[0].id,
      alienId: existing[0].alienId,
      createdAt: existing[0].createdAt,
      updatedAt: new Date(),
    };
  }

  const inserted = await db
    .insert(users)
    .values({ alienId })
    .returning();

  return {
    id: inserted[0].id,
    alienId: inserted[0].alienId,
    createdAt: inserted[0].createdAt,
    updatedAt: inserted[0].updatedAt,
  };
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────

export async function authenticate(): Promise<SessionUser | null> {
  try {
    const headerStore = await headers();
    const token = extractBearerToken(headerStore.get("Authorization"));
    if (!token) return null;

    const { sub } = await verifyToken(token);
    if (!sub) return null;

    return await findOrCreateUser(sub);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: Response }
> {
  const user = await authenticate();
  if (!user) {
    return {
      error: Response.json(
        { error: "Missing or invalid authorization token" },
        { status: 401 }
      ),
    };
  }
  return { user };
}
