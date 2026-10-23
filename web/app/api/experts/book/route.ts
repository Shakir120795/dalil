import { sb, userFromReq, flag, planOf } from "@/lib/server";
import { createPayment } from "@/lib/razorpay";


export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });
  if (!(await flag("experts")) || !(await flag("payments"))) return Response.json({ error: "Bookings are currently unavailable." }, { status: 403 });
  const { expert_id, scheduled_at } = await req.json();
  const when = new Date(scheduled_at);
  if (isNaN(+when) || +when < Date.now()) return Response.json({ error: "Please choose a valid time in the future." }, { status: 400 });
  const { data: ex } = await sb.from("experts").select("id,price_inr").eq("id", expert_id).eq("verified", true).eq("active", true).single();
  if (!ex) return Response.json({ error: "This expert isn't available." }, { status: 404 });
  // Premium/trial users ko video session par 10% discount
  const plan = await planOf(user.id);
  const premium = !!plan && plan.code !== "free";
  const price = premium ? Math.round(ex.price_inr * 0.9) : ex.price_inr;
  const { data: b, error } = await sb.from("bookings").insert({ type: "expert_session", user_id: user.id, expert_id: ex.id,
    scheduled_at: when.toISOString(), amount_inr: price, status: "pending" }).select("id").single();
  if (error || !b) return Response.json({ error: "The booking couldn't be created." }, { status: 500 });
  try {
    const pay = await createPayment(user.id, "booking", b.id, price);
    return Response.json({ ...pay, price_inr: price, original_price_inr: ex.price_inr, discount_pct: premium ? 10 : 0 });
  }
  catch { return Response.json({ error: "Payment couldn't be started." }, { status: 502 }); }
}
