import { sb } from "@/lib/server";

// Deterministic "ayah of the day": din ke hisaab se quran chunks me se ek

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const day = Math.floor(Date.now() / 86400000);
    const { count } = await sb.from("chunks").select("id", { count: "exact", head: true }).eq("source", "quran");
    const total = count ?? 1;
    const { data } = await sb.from("chunks").select("ref,content").eq("source", "quran")
      .order("id").range(day % total, day % total).maybeSingle();
    if (!data) return Response.json({ error: "empty" }, { status: 404 });
    const { data: disp } = await sb.from("display").select("content").eq("ref", data.ref).eq("lang", "ar").maybeSingle();
    return Response.json({ ref: data.ref, arabic: disp?.content ?? null, english: data.content });
  } catch {
    return Response.json({ error: "busy" }, { status: 503 });
  }
}
