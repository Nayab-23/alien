import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  return Response.json({
    user: {
      id: auth.user.id,
      alienSubject: auth.user.alienSubject,
      createdAt: auth.user.createdAt.toISOString(),
    },
  });
}
