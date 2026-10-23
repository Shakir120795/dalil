"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy client: SSR/prerender ke dauran env na ho to bhi module load ho jaye;
// asal client browser me pehle istemal par banta hai.
// Env missing ho to createClient throw karta hai ("supabaseUrl is required") aur
// poora app crash ho jata hai — isliye fallback placeholder client banta hai:
// UI khulta hai, auth "logged out" behave karta hai, asal data tabhi chalega
// jab Vercel me NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY set honge.
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseReady = Boolean(SB_URL && SB_ANON);

let _sbc: SupabaseClient | null = null;
function getSbc(): SupabaseClient {
  if (!_sbc) {
    _sbc = supabaseReady
      ? createClient(SB_URL!, SB_ANON!)
      : createClient("https://placeholder.supabase.co", "placeholder-anon-key");
  }
  return _sbc;
}
export const sbc: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const v = (getSbc() as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as Function).bind(getSbc()) : v;
  },
});

export async function authFetch(url: string, init: RequestInit = {}) {
  const { data } = await sbc.auth.getSession();
  const h = new Headers(init.headers);
  if (data.session) h.set("Authorization", `Bearer ${data.session.access_token}`);
  if (init.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers: h });
}

function loadRazorpay(run: () => void) {
  if ((window as any).Razorpay) return run();
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = run; document.body.appendChild(s);
}

export function checkout(o: { key: string; amount: number; order_id: string }, email: string | undefined, done: (ok: boolean) => void) {
  loadRazorpay(() => new (window as any).Razorpay({
    key: o.key, amount: o.amount, currency: "INR", order_id: o.order_id, name: "Dalil", prefill: { email },
    handler: async (r: any) => {
      const v = await authFetch("/api/pay/verify", { method: "POST", body: JSON.stringify({
        order_id: r.razorpay_order_id, payment_id: r.razorpay_payment_id, signature: r.razorpay_signature }) });
      done(v.ok);
    },
  }).open());
}

// Subscription checkout: order_id ki jagah subscription_id (UPI AutoPay mandate yahin banta hai)
export function checkoutSub(o: { key: string; subscription_id: string }, email: string | undefined, done: (ok: boolean) => void) {
  loadRazorpay(() => new (window as any).Razorpay({
    key: o.key, subscription_id: o.subscription_id, name: "Dalil", prefill: { email },
    handler: async (r: any) => {
      const v = await authFetch("/api/pay/verify", { method: "POST", body: JSON.stringify({
        subscription_id: r.razorpay_subscription_id, payment_id: r.razorpay_payment_id, signature: r.razorpay_signature }) });
      done(v.ok);
    },
  }).open());
}
