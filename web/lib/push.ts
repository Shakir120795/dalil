"use client";
import { authFetch } from "./client";

// Browser/app se push subscribe karne ke helpers. Sab fail-soft hain:
// jo function bhi fail ho, woh { ok: false, message } lautata hai, throw nahi karta.

export type PushResult = { ok: boolean; message: string };
export type PushPrefs = { pref_expert: boolean; pref_dua: boolean; pref_daily: boolean };

const FCM_KEY = "dalil_fcm_token";
const anonId = () => (typeof localStorage !== "undefined" ? localStorage.getItem("anon") : null);

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator
    && "PushManager" in window && "Notification" in window;
}

export async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch { return false; }
}

export async function getPermissionState(): Promise<NotificationPermission | "unsupported"> {
  if (await isNativeApp()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const p = await PushNotifications.checkPermissions();
      return p.receive === "granted" ? "granted" : p.receive === "denied" ? "denied" : "default";
    } catch { return "unsupported"; }
  }
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentWebSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch { return null; }
}

// ---------- Web Push ----------
export async function subscribeWeb(prefs?: Partial<PushPrefs>): Promise<PushResult> {
  try {
    if (!isPushSupported()) return { ok: false, message: "Push notifications aren't supported in this browser." };
    const kr = await fetch("/api/push/key");
    const { publicKey } = await kr.json();
    if (!publicKey) return { ok: false, message: "Push notifications are not set up yet." };
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, message: "Notification permission wasn't granted." };
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    const r = await authFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: sub.toJSON(), anonId: anonId(), prefs }),
    });
    return r.ok ? { ok: true, message: "Push notifications are on." }
      : { ok: false, message: "Couldn't save your subscription. Please try again." };
  } catch { return { ok: false, message: "Something went wrong while turning push on." }; }
}

// ---------- Android (Capacitor + FCM) ----------
export async function subscribeNative(prefs?: Partial<PushPrefs>): Promise<PushResult> {
  try {
    if (!(await isNativeApp())) return subscribeWeb(prefs);
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return { ok: false, message: "Notification permission wasn't granted." };
    const token = await new Promise<string | null>((resolve) => {
      let done = false;
      const finish = (v: string | null) => { if (!done) { done = true; resolve(v); } };
      PushNotifications.addListener("registration", (t) => finish(t.value)).catch(() => {});
      PushNotifications.addListener("registrationError", () => finish(null)).catch(() => {});
      PushNotifications.register().catch(() => finish(null));
      setTimeout(() => finish(localStorage.getItem(FCM_KEY)), 10000);
    });
    if (!token) return { ok: false, message: "Couldn't register this device for push." };
    localStorage.setItem(FCM_KEY, token);
    const r = await authFetch("/api/push/subscribe", {
      method: "POST", body: JSON.stringify({ fcmToken: token, anonId: anonId(), prefs }),
    });
    return r.ok ? { ok: true, message: "Push notifications are on." }
      : { ok: false, message: "Couldn't save your subscription. Please try again." };
  } catch { return { ok: false, message: "Something went wrong while turning push on." }; }
}

// Ek hi entry point: native app ho to FCM, warna Web Push.
export async function subscribePush(prefs?: Partial<PushPrefs>): Promise<PushResult> {
  return (await isNativeApp()) ? subscribeNative(prefs) : subscribeWeb(prefs);
}

export async function isPushOn(): Promise<boolean> {
  if (await isNativeApp()) return !!localStorage.getItem(FCM_KEY);
  return !!(await currentWebSubscription());
}

export async function unsubscribe(): Promise<PushResult> {
  try {
    if (await isNativeApp()) {
      const token = localStorage.getItem(FCM_KEY);
      if (token) await authFetch("/api/push/subscribe", {
        method: "POST", body: JSON.stringify({ unsubscribe: true, fcmToken: token }),
      });
      localStorage.removeItem(FCM_KEY);
      return { ok: true, message: "Push notifications are off." };
    }
    const sub = await currentWebSubscription();
    if (sub) {
      await authFetch("/api/push/subscribe", {
        method: "POST", body: JSON.stringify({ unsubscribe: true, endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    return { ok: true, message: "Push notifications are off." };
  } catch { return { ok: false, message: "Couldn't turn push off. Please try again." }; }
}

// Sirf prefs badalna (subscribe dobara kiye bina)
export async function updatePrefs(partial: Partial<PushPrefs>): Promise<PushResult> {
  try {
    if (await isNativeApp()) {
      const token = localStorage.getItem(FCM_KEY);
      if (!token) return { ok: false, message: "Turn push on first." };
      const r = await authFetch("/api/push/subscribe", {
        method: "POST", body: JSON.stringify({ fcmToken: token, anonId: anonId(), prefs: partial }),
      });
      return r.ok ? { ok: true, message: "Saved." } : { ok: false, message: "Couldn't save. Please try again." };
    }
    const sub = await currentWebSubscription();
    if (!sub) return { ok: false, message: "Turn push on first." };
    const r = await authFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: sub.toJSON(), anonId: anonId(), prefs: partial }),
    });
    return r.ok ? { ok: true, message: "Saved." } : { ok: false, message: "Couldn't save. Please try again." };
  } catch { return { ok: false, message: "Couldn't save. Please try again." }; }
}

// Is device ki server par saved prefs (profile toggles reflect karne ke liye)
export async function currentDevicePrefs(): Promise<PushPrefs | null> {
  try {
    let qs = "";
    if (await isNativeApp()) {
      const token = localStorage.getItem(FCM_KEY);
      if (!token) return null;
      qs = `?fcmToken=${encodeURIComponent(token)}`;
    } else {
      const sub = await currentWebSubscription();
      if (!sub) return null;
      qs = `?endpoint=${encodeURIComponent(sub.endpoint)}`;
    }
    const r = await fetch(`/api/push/subscribe${qs}`);
    if (!r.ok) return null;
    const j = await r.json();
    return (j.prefs as PushPrefs) ?? null;
  } catch { return null; }
}
