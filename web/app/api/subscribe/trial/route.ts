import { sb, userFromReq, planOf } from "@/lib/server";

// 7-day free trial — bina card. Ek user ko zindagi me ek hi baar (trial_claims).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });
  const plan = await planOf(user.id);
  if (plan && plan.code !== "free")
    return Response.json({ error: "You already have Premium or an active trial." }, { status: 400 });
  const { error: claimErr } = await sb.from("trial_claims").insert({ user_id: user.id });
  if (claimErr) return Response.json({ error: "You have already used your free trial." }, { status: 400 });
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  const { error } = await sb.from("subscriptions").insert({
    user_id: user.id, plan_code: "trial", status: "trialing", provider: "trial",
    current_period_start: now.toISOString(), trial_end: end.toISOString(), current_period_end: end.toISOString(),
  });
  if (error) return Response.json({ error: "The trial couldn't be started. Please try again." }, { status: 500 });
  return Response.json({ ok: true, trial_end: end.toISOString() });
}
