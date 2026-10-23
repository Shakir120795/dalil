import { sb, userFromReq, planOf, flag } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await userFromReq(req);
  const { data: plans } = await sb.from("plans").select("*").eq("active", true).order("price_inr");
  return Response.json({ plans, current: user ? (await planOf(user.id))?.code : null, loggedIn: !!user, paymentsOn: await flag("payments") });
}
