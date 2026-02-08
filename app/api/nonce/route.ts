import { createNonce } from "@/lib/auth";

export async function GET() {
  const nonce = await createNonce();
  return Response.json({ nonce });
}
