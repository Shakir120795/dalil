import { sb } from "@/lib/server";
import { sendDailyToAll } from "@/lib/pushSend";

// Daily "Verse of the Day" push — sirf cron ke liye (Authorization: Bearer CRON_SECRET).
// Ayah bilkul /api/ayah-of-day ki tarah choose hoti hai (din ke hisaab se deterministic).

export const dynamic = "force-dynamic";

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const day = Math.floor(Date.now() / 86400000);
    const { count } = await sb.from("chunks").select("id", { count: "exact", head: true }).eq("source", "quran");
    const total = count ?? 1;
    const { data } = await sb.from("chunks").select("ref,content").eq("source", "quran")
      .order("id").range(day % total, day % total).maybeSingle();
    if (!data) return Response.json({ sent: 0, failed: 0, skipped: 0 });
    const body = String(data.content).length > 120
      ? String(data.content).slice(0, 117).trimEnd() + "…" : String(data.content);
    const counts = await sendDailyToAll({ title: "Verse of the Day", body, url: "/" });
    return Response.json(counts);
  } catch {
    return Response.json({ sent: 0, failed: 0, skipped: 0 });
  }
}

// POST external schedulers ke liye, GET Vercel Cron ke liye (woh khud
// CRON_SECRET wala Authorization header bhejta hai).
export const POST = run;
export const GET = run;
