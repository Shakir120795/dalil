import { sb, userFromReq } from "@/lib/server";
import { cancelSubscription } from "@/lib/razorpay";

// Cancel matlab renew band — access current_period_end tak rehta hai (cancel_at_period_end).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });
  const { data: sub } = await sb.from("subscriptions")
    .select("id,provider,provider_subscription_id,current_period_end")
    .eq("user_id", user.id).in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!sub) return Response.json({ error: "You don't have an active subscription." }, { status: 404 });
  if (sub.provider === "razorpay" && sub.provider_subscription_id) {
    try { await cancelSubscription(sub.provider_subscription_id); }
    catch { return Response.json({ error: "Cancellation failed. Please try again." }, { status: 502 }); }
  }
  // trial (provider='trial') ka koi mandate nahi — sirf local flag kaafi hai
  await sb.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id);
  return Response.json({ ok: true, current_period_end: sub.current_period_end });
}
