import { sb, userFromReq, flag } from "@/lib/server";
import { createPayment } from "@/lib/razorpay";


export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });
  if (!(await flag("payments"))) return Response.json({ error: "Payments are currently unavailable." }, { status: 403 });
  const { plan } = await req.json();
  const { data: p } = await sb.from("plans").select("*").eq("code", plan).eq("active", true).single();
  if (!p || p.price_inr <= 0) return Response.json({ error: "Invalid plan." }, { status: 400 });
  try { return Response.json(await createPayment(user.id, "plan", p.code, p.price_inr)); }
  catch { return Response.json({ error: "Payment couldn't be started. Please try again." }, { status: 502 }); }
}
