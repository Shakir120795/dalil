import { sb, userFromReq, planOf } from "@/lib/server";

// User ki current subscription haalat — upgrade page aur watermark gating ke liye.
// plan_code hamesha effective access (planOf) se aata hai; status/dates display ke liye.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ loggedIn: false, plan_code: "free", status: "free",
    current_period_end: null, trial_end: null, cancel_at_period_end: false, trial_claimed: false });
  const plan = await planOf(user.id);
  const { data: subs } = await sb.from("subscriptions")
    .select("plan_code,status,current_period_end,trial_end,cancel_at_period_end,created_at")
    .eq("user_id", user.id).in("status", ["trialing", "active", "past_due", "cancelled"])
    .order("created_at", { ascending: false }).limit(10);
  const now = Date.now();
  const live = (subs ?? []).find(s => {
    const end = s.current_period_end ? +new Date(s.current_period_end) : 0;
    if (s.status === "trialing" || s.status === "active") return end > now;
    if (s.status === "past_due") return true;   // grace planOf() me lagta hai; yahan haalat dikhao
    if (s.status === "cancelled") return !!s.cancel_at_period_end && end > now;
    return false;
  }) ?? null;
  const { data: claim } = await sb.from("trial_claims").select("user_id").eq("user_id", user.id).maybeSingle();
  return Response.json({ loggedIn: true, plan_code: plan?.code ?? "free",
    status: live?.status ?? "free", current_period_end: live?.current_period_end ?? null,
    trial_end: live?.trial_end ?? null, cancel_at_period_end: !!live?.cancel_at_period_end,
    trial_claimed: !!claim });
}
