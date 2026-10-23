import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy client: build-time page data collection me env vars nahi hote,
// isliye client pehli actual request par banta hai. sb.from(...) API same hai.
let _sb: SupabaseClient | null = null;
function getSb(): SupabaseClient {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return _sb;
}
export const sb: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const v = (getSb() as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as Function).bind(getSb()) : v;
  },
});

export async function userFromReq(req: Request) {
  const t = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!t) return null;
  const { data } = await sb.auth.getUser(t);
  return data.user ?? null;
}
export async function flag(key: string) {
  const { data } = await sb.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  return !!data?.enabled;
}
export type PlanRow = { code: string; name: string; daily_chat_limit: number | null };
type SubRow = { plan_code: string; status: string; current_period_end: string | null;
  trial_end: string | null; cancel_at_period_end: boolean | null; past_due_since: string | null };

const GRACE_MS = 3 * 86400000;  // past_due par 3 din ka grace

// Kaunsi subscription abhi premium access deti hai?
// active (period baaki) | trialing (trial baaki) | past_due (3 din grace) | cancelled (period-end tak)
function grantsAccess(s: SubRow, now: number) {
  const end = s.current_period_end ? +new Date(s.current_period_end) : 0;
  if (s.status === "active") return end > now;
  if (s.status === "trialing") return end > now || (!!s.trial_end && +new Date(s.trial_end) > now);
  if (s.status === "past_due") return !!s.past_due_since && now - +new Date(s.past_due_since) <= GRACE_MS;
  if (s.status === "cancelled") return !!s.cancel_at_period_end && end > now;
  return false;
}

export async function planOf(uid: string) {
  let code = "free";
  const now = Date.now();
  const { data: subs, error } = await sb.from("subscriptions")
    .select("plan_code,status,current_period_end,trial_end,cancel_at_period_end,past_due_since")
    .eq("user_id", uid).in("status", ["active", "trialing", "past_due", "cancelled"])
    .order("created_at", { ascending: false }).limit(10);
  if (!error && subs) {
    const hit = (subs as SubRow[]).find(s => grantsAccess(s, now));
    if (hit) code = hit.plan_code;
  } else {
    // migration 007 na chali ho to purana behaviour (sirf active + period)
    const { data } = await sb.from("subscriptions").select("plan_code").eq("user_id", uid).eq("status", "active")
      .gt("current_period_end", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
    code = data?.[0]?.plan_code ?? "free";
  }
  const { data: p } = await sb.from("plans").select("*").eq("code", code).single();
  return p as PlanRow | null;
}

// Premium = effective plan 'free' ke alawa koi bhi (premium_monthly/yearly, trial, purana premium)
export async function isPremium(uid: string) {
  const p = await planOf(uid);
  return !!p && p.code !== "free";
}
