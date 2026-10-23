import { sb, userFromReq } from "@/lib/server";

// Browser (Web Push) ya Android app (FCM token) ki subscription save/update.
// Login optional hai: user_id tabhi lagta hai jab Bearer token mile.
// Row ki pehchaan: web -> endpoint, android -> fcm_token (009 ke unique indexes).

export const dynamic = "force-dynamic";

type Prefs = { pref_expert?: boolean; pref_dua?: boolean; pref_daily?: boolean };

function cleanPrefs(p: any): Prefs {
  const out: Prefs = {};
  if (typeof p?.pref_expert === "boolean") out.pref_expert = p.pref_expert;
  if (typeof p?.pref_dua === "boolean") out.pref_dua = p.pref_dua;
  if (typeof p?.pref_daily === "boolean") out.pref_daily = p.pref_daily;
  return out;
}

async function findRow(platform: "web" | "android", key: string) {
  const col = platform === "web" ? "endpoint" : "fcm_token";
  const { data } = await sb.from("push_subscriptions").select("id")
    .eq("platform", platform).eq(col, key).maybeSingle();
  return data as { id: string } | null;
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const user = await userFromReq(req);
  const anonId = typeof body.anonId === "string" ? body.anonId.slice(0, 80) : null;
  const prefs = cleanPrefs(body.prefs);

  const webSub = body.subscription;
  const endpoint: string | undefined = webSub?.endpoint;
  const fcmToken: string | undefined = typeof body.fcmToken === "string" ? body.fcmToken : undefined;

  // --- Unsubscribe ---
  if (body.unsubscribe === true) {
    if (endpoint) await sb.from("push_subscriptions").delete().eq("platform", "web").eq("endpoint", endpoint);
    else if (fcmToken) await sb.from("push_subscriptions").delete().eq("platform", "android").eq("fcm_token", fcmToken);
    return Response.json({ ok: true });
  }

  // --- Web Push subscription ---
  if (endpoint) {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
      return Response.json({ error: "Push notifications are not set up yet." }, { status: 503 });
    const keys = webSub?.keys ?? {};
    if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string")
      return Response.json({ error: "Incomplete push subscription." }, { status: 400 });
    const row = {
      user_id: user?.id ?? null, anon_id: anonId, platform: "web",
      endpoint, p256dh: keys.p256dh, auth: keys.auth,
      last_seen_at: new Date().toISOString(), ...prefs,
    };
    const existing = await findRow("web", endpoint);
    const { error } = existing
      ? await sb.from("push_subscriptions").update(row).eq("id", existing.id)
      : await sb.from("push_subscriptions").insert(row);
    if (error) return Response.json({ error: "Couldn't save the subscription." }, { status: 500 });
    return Response.json({ ok: true });
  }

  // --- Android FCM token ---
  if (fcmToken) {
    const row = {
      user_id: user?.id ?? null, anon_id: anonId, platform: "android",
      fcm_token: fcmToken, last_seen_at: new Date().toISOString(), ...prefs,
    };
    const existing = await findRow("android", fcmToken);
    const { error } = existing
      ? await sb.from("push_subscriptions").update(row).eq("id", existing.id)
      : await sb.from("push_subscriptions").insert(row);
    if (error) return Response.json({ error: "Couldn't save the subscription." }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Nothing to save." }, { status: 400 });
}

// Is device ki saved prefs (profile page toggles reflect karne ke liye)
export async function GET(req: Request) {
  const u = new URL(req.url);
  const endpoint = u.searchParams.get("endpoint");
  const fcmToken = u.searchParams.get("fcmToken");
  let q = sb.from("push_subscriptions").select("pref_expert,pref_dua,pref_daily");
  if (endpoint) q = q.eq("platform", "web").eq("endpoint", endpoint);
  else if (fcmToken) q = q.eq("platform", "android").eq("fcm_token", fcmToken);
  else return Response.json({ prefs: null });
  const { data } = await q.maybeSingle();
  return Response.json({ prefs: data ?? null });
}

export async function DELETE(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* query params bhi chalega */ }
  const u = new URL(req.url);
  const endpoint = body.endpoint ?? u.searchParams.get("endpoint");
  const fcmToken = body.fcmToken ?? u.searchParams.get("fcmToken");
  if (endpoint) await sb.from("push_subscriptions").delete().eq("platform", "web").eq("endpoint", endpoint);
  else if (fcmToken) await sb.from("push_subscriptions").delete().eq("platform", "android").eq("fcm_token", fcmToken);
  return Response.json({ ok: true });
}
