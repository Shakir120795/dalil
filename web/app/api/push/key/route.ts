export const dynamic = "force-dynamic";

// Client ko batata hai ki Web Push available hai ya nahi (VAPID public key).
export async function GET() {
  return Response.json({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null });
}
