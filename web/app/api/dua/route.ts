import { sb, userFromReq, flag } from "@/lib/server";
import { createPayment } from "@/lib/razorpay";


export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });
  if (!(await flag("dua_requests")) || !(await flag("payments"))) return Response.json({ error: "The dua service is currently unavailable." }, { status: 403 });
  const { expert_id, intention } = await req.json();
  if (typeof intention !== "string" || intention.trim().length < 3 || intention.length > 500) return Response.json({ error: "Please write your intention in 3 to 500 characters." }, { status: 400 });
  const { data: ex } = await sb.from("experts").select("id,dua_price_inr").eq("id", expert_id).eq("verified", true).eq("active", true).not("dua_price_inr", "is", null).single();
  if (!ex) return Response.json({ error: "This expert isn't available." }, { status: 404 });
  const { data: b } = await sb.from("bookings").insert({ type: "dua_request", user_id: user.id, expert_id: ex.id,
    amount_inr: ex.dua_price_inr, notes: intention.trim(), status: "pending" }).select("id").single();
  if (!b) return Response.json({ error: "The request couldn't be created." }, { status: 500 });
  try { return Response.json(await createPayment(user.id, "booking", b.id, ex.dua_price_inr)); }
  catch { return Response.json({ error: "Payment couldn't be started." }, { status: 502 }); }
}
