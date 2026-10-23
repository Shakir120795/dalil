import crypto from "crypto";
import { sb } from "./server";

export async function createPayment(userId: string, kind: "plan" | "booking", ref: string, amountInr: number) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountInr * 100, currency: "INR", receipt: `${kind}-${ref}`.slice(0, 40) }),
  });
  if (!r.ok) throw new Error("razorpay order failed");
  const o = await r.json();
  await sb.from("payments").insert({ user_id: userId, kind, ref, razorpay_order_id: o.id, amount_inr: amountInr });
  return { order_id: o.id as string, amount: o.amount as number, key: process.env.RAZORPAY_KEY_ID };
}

export function validSig(orderId: string, paymentId: string, sig: string) {
  const e = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest("hex");
  return e.length === sig.length && crypto.timingSafeEqual(Buffer.from(e), Buffer.from(sig));
}

// Subscription checkout ki signature: HMAC(payment_id|subscription_id) — Razorpay docs
export function validSubSig(paymentId: string, subscriptionId: string, sig: string) {
  const e = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${paymentId}|${subscriptionId}`).digest("hex");
  return e.length === sig.length && crypto.timingSafeEqual(Buffer.from(e), Buffer.from(sig));
}

function rzpAuth() {
  return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

// Razorpay dashboard me bane plan par subscription banao (UPI AutoPay mandate checkout se banta hai)
export async function createSubscription(planId: string, totalCount: number) {
  const r = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: rzpAuth() },
    body: JSON.stringify({ plan_id: planId, total_count: totalCount, quantity: 1, customer_notify: 1 }),
  });
  if (!r.ok) throw new Error("razorpay subscription failed");
  return (await r.json()) as { id: string; status?: string };
}

export async function cancelSubscription(subscriptionId: string) {
  const r = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: rzpAuth() },
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  });
  if (!r.ok) throw new Error("razorpay cancel failed");
  return await r.json();
}
