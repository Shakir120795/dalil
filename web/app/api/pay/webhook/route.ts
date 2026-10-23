import crypto from "crypto";
import { sb } from "@/lib/server";

// Razorpay webhook: subscription lifecycle yahin se pakka hota hai
// (user tab band kar de to bhi). Signature + idempotency zaroori hai.

export const dynamic = "force-dynamic";

type SubEntity = { id: string; status?: string; current_start?: number | null; current_end?: number | null };
const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

async function findSub(subId: string) {
  const { data } = await sb.from("subscriptions").select("*")
    .eq("provider_subscription_id", subId).order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

async function patchSub(subId: string, patch: Record<string, unknown>) {
  await sb.from("subscriptions").update(patch).eq("provider_subscription_id", subId);
}

export async function POST(req: Request) {
  const secret = process.env["RAZORPAY_WEBHOOK" + "_SECRET"];
  if (!secret) return Response.json({ error: "webhook not configured" }, { status: 500 });
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") || "";
  const expect = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (expect.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig)))
    return Response.json({ error: "bad signature" }, { status: 400 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const eventType: string = body?.event ?? "unknown";
  const eventId: string = req.headers.get("x-razorpay-event-id") || body?.id ||
    crypto.createHash("sha256").update(raw).digest("hex");

  // Idempotency: ek event ek hi baar process hoga
  const { error: dupErr } = await sb.from("webhook_events")
    .insert({ provider: "razorpay", event_id: eventId, event_type: eventType, payload: body });
  if (dupErr) {
    const { data: seen } = await sb.from("webhook_events").select("id").eq("event_id", eventId).maybeSingle();
    if (seen) return Response.json({ ok: true, duplicate: true });
    return Response.json({ error: "log failed" }, { status: 500 });
  }

  const subEnt: SubEntity | undefined = body?.payload?.subscription?.entity;
  const payEnt = body?.payload?.payment?.entity as
    { id: string; amount?: number; subscription_id?: string } | undefined;

  try {
    switch (eventType) {
      case "subscription.activated": {
        if (subEnt) await patchSub(subEnt.id, { status: "active", past_due_since: null,
          current_period_start: iso(subEnt.current_start), current_period_end: iso(subEnt.current_end) });
        break;
      }
      case "subscription.charged": {
        if (subEnt) {
          await patchSub(subEnt.id, { status: "active", past_due_since: null,
            current_period_start: iso(subEnt.current_start) ?? undefined,
            current_period_end: iso(subEnt.current_end) });
          const row = await findSub(subEnt.id);
          if (row && payEnt) await sb.from("payments").insert({
            user_id: row.user_id, kind: "subscription", ref: subEnt.id, razorpay_order_id: null,
            razorpay_payment_id: payEnt.id, amount_inr: Math.round((payEnt.amount ?? 0) / 100), status: "paid" });
        }
        break;
      }
      case "subscription.pending":
      case "subscription.halted": {
        if (subEnt) {
          const row = await findSub(subEnt.id);
          await patchSub(subEnt.id, { status: "past_due",
            past_due_since: row?.past_due_since ?? new Date().toISOString() });
        }
        break;
      }
      case "subscription.cancelled": {
        // Access period-end tak rehta hai; renew band
        if (subEnt) await patchSub(subEnt.id, { status: "cancelled", cancel_at_period_end: true });
        break;
      }
      case "subscription.completed":
      case "subscription.expired": {
        if (subEnt) await patchSub(subEnt.id, { status: "expired" });
        break;
      }
      case "payment.failed": {
        const subId = payEnt?.subscription_id;
        if (subId) {
          const row = await findSub(subId);
          if (row && row.status !== "past_due")
            await patchSub(subId, { status: "past_due", past_due_since: new Date().toISOString() });
        }
        break;
      }
      default: break;  // baaki events sirf log hue hain (upar insert)
    }
  } catch {
    // Process fail: log row hatao + 500, taaki Razorpay retry kare aur event dobara process ho
    await sb.from("webhook_events").delete().eq("event_id", eventId);
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
