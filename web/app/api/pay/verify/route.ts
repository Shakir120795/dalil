import { sb, userFromReq } from "@/lib/server";
import { validSig, validSubSig } from "@/lib/razorpay";
import { sendToUser } from "@/lib/pushSend";

async function dailyRoom(id: string) {
  if (!process.env.DAILY_API_KEY) return null;
  const r = await fetch("https://api.daily.co/v1/rooms", { method: "POST",
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `b-${id}`, properties: { exp: Math.floor(Date.now() / 1000) + 14 * 86400 } }) });
  return r.ok ? (await r.json()).url as string : null;
}


export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "login" }, { status: 401 });
  const body = await req.json();

  // --- Subscription checkout verify (signature = HMAC(payment_id|subscription_id)) ---
  const subId: string | undefined = body.subscription_id ?? body.razorpay_subscription_id;
  if (subId) {
    const { payment_id, signature } = body;
    const { data: sub } = await sb.from("subscriptions").select("*")
      .eq("provider_subscription_id", subId).eq("user_id", user.id).single();
    if (!sub || !payment_id || !signature || !validSubSig(payment_id, subId, signature))
      return Response.json({ error: "Payment couldn't be verified." }, { status: 400 });
    if (sub.status === "active") return Response.json({ ok: true });
    const { data: p } = await sb.from("plans").select("interval").eq("code", sub.plan_code).single();
    const start = new Date(); const end = new Date(start);
    if (p?.interval === "year") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
    await sb.from("subscriptions").update({ status: "active", provider_ref: payment_id,
      current_period_start: start.toISOString(), current_period_end: end.toISOString() }).eq("id", sub.id);
    return Response.json({ ok: true });
  }

  // --- Purana one-time flow (plan purchase / booking) — untouched ---
  const { order_id, payment_id, signature } = body;
  const { data: pay } = await sb.from("payments").select("*").eq("razorpay_order_id", order_id).eq("user_id", user.id).single();
  if (!pay || !validSig(order_id, payment_id, signature)) return Response.json({ error: "Payment couldn't be verified." }, { status: 400 });
  if (pay.status === "paid") return Response.json({ ok: true });
  await sb.from("payments").update({ status: "paid", razorpay_payment_id: payment_id }).eq("id", pay.id);
  if (pay.kind === "plan") {
    await sb.from("subscriptions").insert({ user_id: user.id, plan_code: pay.ref, status: "active", provider: "razorpay",
      provider_ref: payment_id, current_period_end: new Date(Date.now() + 30 * 86400000).toISOString() });
  } else {
    const { data: bk } = await sb.from("bookings").select("type").eq("id", pay.ref).single();
    await sb.from("bookings").update({ status: "paid", provider: "razorpay", provider_ref: payment_id,
      meeting_url: bk?.type === "expert_session" ? await dailyRoom(pay.ref) : null }).eq("id", pay.ref);
    // Push: booking confirm hone ki khabar (fail-soft, payment flow nahi rukta)
    await sendToUser(user.id, "booking", {
      title: "Session booked",
      body: "Your expert session is confirmed.",
      url: "/experts",
    });
  }
  return Response.json({ ok: true });
}
