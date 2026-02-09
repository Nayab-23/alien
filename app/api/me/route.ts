import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    return Response.json({
      user: {
        id: auth.user.id,
        alienId: auth.user.alienId,
        createdAt: auth.user.createdAt.toISOString(),
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
