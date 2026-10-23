import { sb, userFromReq, flag } from "@/lib/server";
import { createSubscription } from "@/lib/razorpay";

// Razorpay Subscriptions: dashboard wale plan_id par subscription banti hai,
// pehli payment + UPI AutoPay mandate checkout (subscription_id) se hota hai.

export const dynamic = "force-dynamic";

const PLANS: Record<string, { env: string | undefined; totalCount: number }> = {
  premium_monthly: { env: process.env.RAZORPAY_PLAN_ID_MONTHLY, totalCount: 120 },
  premium_yearly: { env: process.env.RAZORPAY_PLAN_ID_YEARLY, totalCount: 10 },
};

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });
  if (!(await flag("payments"))) return Response.json({ error: "Payments are currently unavailable." }, { status: 403 });
  const { plan } = await req.json();
  const cfg = PLANS[plan as string];
  if (!cfg) return Response.json({ error: "Invalid plan." }, { status: 400 });
  if (!cfg.env) return Response.json({ error: "This plan isn't set up yet. Please try again later." }, { status: 500 });
  const { data: p } = await sb.from("plans").select("price_inr").eq("code", plan).single();
  if (!p) return Response.json({ error: "Invalid plan." }, { status: 400 });
  try {
    const s = await createSubscription(cfg.env, cfg.totalCount);
    const { error } = await sb.from("subscriptions").insert({
      user_id: user.id, plan_code: plan, status: "created", provider: "razorpay",
      provider_subscription_id: s.id, current_period_end: null,
    });
    if (error) throw error;
    return Response.json({ subscription_id: s.id, key: process.env.RAZORPAY_KEY_ID, amount: (p.price_inr as number) * 100 });
  } catch { return Response.json({ error: "The subscription couldn't be started. Please try again." }, { status: 502 }); }
}
