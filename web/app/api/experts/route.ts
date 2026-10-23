import { sb, userFromReq, flag } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await flag("experts"))) return Response.json({ enabled: false });
  const user = await userFromReq(req);
  const { data: experts } = await sb.from("experts").select("id,name,bio,languages,madhab,credential,price_inr,dua_price_inr").eq("verified", true).eq("active", true);
  const { data: mine } = user ? await sb.from("bookings").select("id,type,status,scheduled_at,meeting_url,expert_id,completed_at").eq("user_id", user.id).order("created_at", { ascending: false }) : { data: [] };
  return Response.json({ enabled: true, experts, mine, paymentsOn: await flag("payments") });
}
