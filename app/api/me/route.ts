import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const createdAt = auth.user.createdAt instanceof Date
      ? auth.user.createdAt.toISOString()
      : new Date(auth.user.createdAt as unknown as number * 1000).toISOString();

    return Response.json({
      user: {
        id: auth.user.id,
        alienSubject: auth.user.alienSubject,
        createdAt,
      },
    });
  } catch (err) {
    console.error("Failed to get user:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
