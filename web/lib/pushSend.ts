// Server-side push bhejna: Web Push (VAPID) browser ke liye, FCM HTTP v1
// Android app ke liye. Yeh module sirf server par import hota hai.
// Har send fail-soft hai — push fail ho to caller ka flow kabhi nahi rukta.
import crypto from "crypto";
import webpush from "web-push";
import { sb } from "./server";

export type PushKind = "expert" | "dua" | "daily" | "booking";
export type PushPayload = { title: string; body: string; url: string };

type SubRow = {
  id: string; platform: string; endpoint: string | null; p256dh: string | null;
  auth: string | null; fcm_token: string | null;
  pref_expert: boolean; pref_dua: boolean; pref_daily: boolean;
};

const PREF_FOR: Record<PushKind, keyof SubRow> = {
  expert: "pref_expert", dua: "pref_dua", daily: "pref_daily",
  booking: "pref_expert",   // booking updates expert wali pref follow karte hain
};

// ---------- Web Push (VAPID) ----------
let vapidReady = false;
function setupVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@getdalil.app", pub, priv);
    vapidReady = true;
  } catch { /* bad keys: skip web push */ }
  return vapidReady;
}

// ---------- FCM HTTP v1 (service account -> OAuth access token) ----------
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let saCache: ServiceAccount | null | undefined;   // undefined = not parsed yet
let fcmToken: { value: string; exp: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (saCache !== undefined) return saCache;
  saCache = null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (j.project_id && j.client_email && j.private_key) {
      saCache = { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key };
    }
  } catch { /* invalid JSON: skip FCM */ }
  return saCache;
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function fcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  if (fcmToken && fcmToken.exp > Date.now() + 60000) return fcmToken.value;
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(JSON.stringify({
      iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
    }));
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const sig = b64url(signer.sign(sa.private_key));
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claims}.${sig}`,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.access_token) return null;
    fcmToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 3600) * 1000) };
    return fcmToken.value;
  } catch { return null; }
}

async function sendFcm(sa: ServiceAccount, token: string, p: PushPayload): Promise<boolean> {
  try {
    const access = await fcmAccessToken(sa);
    if (!access) return false;
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: p.title, body: p.body },
          data: { url: p.url },
          android: { notification: { icon: "ic_launcher", click_action: "OPEN_APP" } },
        },
      }),
    });
    return r.ok;
  } catch { return false; }
}

// ---------- Ek subscription par bhejna ----------
async function sendOne(sub: SubRow, p: PushPayload): Promise<"sent" | "dead" | "failed" | "skipped"> {
  if (sub.platform === "web") {
    if (!sub.endpoint || !sub.p256dh || !sub.auth) return "skipped";
    if (!setupVapid()) return "skipped";
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(p));
      return "sent";
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) return "dead";  // subscription khatam
      return "failed";
    }
  }
  if (sub.platform === "android") {
    if (!sub.fcm_token) return "skipped";
    const sa = serviceAccount();
    if (!sa) return "skipped";
    return (await sendFcm(sa, sub.fcm_token, p)) ? "sent" : "failed";
  }
  return "skipped";
}

async function deliver(subs: SubRow[], p: PushPayload) {
  let sent = 0, failed = 0, skipped = 0;
  for (const sub of subs) {
    const r = await sendOne(sub, p);
    if (r === "sent") sent++;
    else if (r === "dead") {
      failed++;
      try { await sb.from("push_subscriptions").delete().eq("id", sub.id); } catch { /* ignore */ }
    } else if (r === "failed") failed++;
    else skipped++;
  }
  return { sent, failed, skipped };
}

// Ek user ko push (expert reply, dua done, booking confirm). Kabhi throw nahi karta.
export async function sendToUser(userId: string, kind: PushKind, p: PushPayload) {
  try {
    if (!userId) return;
    const pref = PREF_FOR[kind];
    const { data } = await sb.from("push_subscriptions").select("*")
      .eq("user_id", userId).eq(pref, true);
    if (data?.length) await deliver(data as SubRow[], p);
  } catch { /* push kabhi main flow nahi todta */ }
}

// Daily verse: pref_daily wale sab subscriptions ko, batches me.
export async function sendDailyToAll(p: PushPayload) {
  const counts = { sent: 0, failed: 0, skipped: 0 };
  try {
    const { data } = await sb.from("push_subscriptions").select("*").eq("pref_daily", true);
    const subs = (data ?? []) as SubRow[];
    const BATCH = 50;
    for (let i = 0; i < subs.length; i += BATCH) {
      const r = await deliver(subs.slice(i, i + BATCH), p);
      counts.sent += r.sent; counts.failed += r.failed; counts.skipped += r.skipped;
    }
  } catch { /* zeros laut-te hain */ }
  return counts;
}
