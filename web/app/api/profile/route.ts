import { sb, userFromReq, planOf } from "@/lib/server";
import { REPLY_LANGS } from "@/lib/lang";

// User profile: account info, plan summary, saved preferences, activity counts.
// Preferences live on the profiles table (migration 008); reads fail soft when
// the migration has not run yet (fields come back null).

export const dynamic = "force-dynamic";

const TRANS_LANGS = ["en", "hi", "ur"];
const FIELDS = "display_name,answer_lang,translation_lang,region,prayer_method,prayer_school";

export async function GET(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please sign in to view your profile." }, { status: 401 });

  const { data: prof } = await sb.from("profiles").select(FIELDS).eq("id", user.id).maybeSingle();
  const plan = await planOf(user.id);

  let planInfo: { code: string; status: string; current_period_end: string | null; trial_end: string | null } =
    { code: plan?.code ?? "free", status: "free", current_period_end: null, trial_end: null };
  if (plan && plan.code !== "free") {
    const { data: subs } = await sb.from("subscriptions")
      .select("plan_code,status,current_period_end,trial_end")
      .eq("user_id", user.id).in("status", ["trialing", "active", "past_due", "cancelled"])
      .order("created_at", { ascending: false }).limit(10);
    const live = (subs ?? []).find(s => s.plan_code === plan.code) ?? (subs ?? [])[0];
    planInfo = { code: plan.code, status: live?.status ?? "active",
      current_period_end: live?.current_period_end ?? null, trial_end: live?.trial_end ?? null };
  }

  const cnt = async (t: string, extra?: (q: any) => any) => {
    let q = sb.from(t).select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if (extra) q = extra(q);
    const { count } = await q;
    return count ?? 0;
  };
  const [questions, expert_questions, bookings, dua_requests] = await Promise.all([
    cnt("questions_log"),
    cnt("expert_text_questions"),
    cnt("bookings"),
    cnt("bookings", q => q.eq("type", "dua_request")),
  ]);

  return Response.json({
    email: user.email ?? null,
    display_name: prof?.display_name ?? null,
    answer_lang: prof?.answer_lang ?? "auto",
    translation_lang: prof?.translation_lang ?? null,
    region: prof?.region ?? null,
    prayer_method: prof?.prayer_method ?? null,
    prayer_school: prof?.prayer_school ?? null,
    plan: planInfo,
    counts: { questions, expert_questions, bookings, dua_requests },
  });
}

export async function PUT(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please sign in to update your profile." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });

  const row: Record<string, unknown> = { id: user.id };
  const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

  if (b.display_name !== undefined) {
    if (typeof b.display_name !== "string") return bad("Display name must be text.");
    const v = b.display_name.trim();
    if (v.length > 60) return bad("Display name must be 60 characters or fewer.");
    row.display_name = v || null;
  }
  if (b.answer_lang !== undefined) {
    if (typeof b.answer_lang !== "string" || (b.answer_lang !== "auto" && !(b.answer_lang in REPLY_LANGS)))
      return bad("Please choose a valid answer language.");
    row.answer_lang = b.answer_lang;
  }
  if (b.translation_lang !== undefined) {
    if (!TRANS_LANGS.includes(b.translation_lang)) return bad("Please choose a valid translation language.");
    row.translation_lang = b.translation_lang;
  }
  if (b.region !== undefined) {
    if (typeof b.region !== "string" || b.region.length > 60) return bad("Please choose a valid region.");
    row.region = b.region;
  }
  if (b.prayer_method !== undefined) {
    if (!Number.isInteger(b.prayer_method) || b.prayer_method < 0 || b.prayer_method > 24)
      return bad("Please choose a valid prayer calculation method.");
    row.prayer_method = b.prayer_method;
  }
  if (b.prayer_school !== undefined) {
    if (b.prayer_school !== 0 && b.prayer_school !== 1) return bad("Please choose a valid Asr calculation.");
    row.prayer_school = b.prayer_school;
  }
  if (Object.keys(row).length === 1) return bad("Nothing to update.");

  const { data, error } = await sb.from("profiles").upsert(row, { onConflict: "id" }).select(FIELDS).single();
  if (error || !data) return Response.json({ error: "Could not save your profile. Please try again later." }, { status: 500 });
  return Response.json({
    display_name: data.display_name ?? null, answer_lang: data.answer_lang ?? "auto",
    translation_lang: data.translation_lang ?? null, region: data.region ?? null,
    prayer_method: data.prayer_method ?? null, prayer_school: data.prayer_school ?? null,
  });
}
