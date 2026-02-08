import { createNonce } from "@/lib/auth";

export async function GET() {
  try {
    const nonce = await createNonce();
    return Response.json({ nonce });
  } catch (err) {
    console.error("Failed to create nonce:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create nonce" },
      { status: 500 }
    );
  }
}
