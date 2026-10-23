import { sb } from "@/lib/server";
import { adminFromReq } from "@/lib/admin";

const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);


export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await adminFromReq(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await sb.from("questions_log").select("topic,lang,answered,question,top_sim,created_at")
    .gte("created_at", since).limit(10000);
  const rows = data ?? [];
  const topics = new Map<string, number>(), langs = new Map<string, number>(), days = new Map<string, number>(),
    unanswered = new Map<string, number>(), weak = new Map<string, number>();
  for (const r of rows) {
    inc(topics, r.topic ?? "other"); inc(langs, r.lang ?? "en"); inc(days, r.created_at.slice(0, 10));
    const q = (r.question ?? "").toLowerCase().trim();
    if (!r.answered) inc(unanswered, q); else if ((r.top_sim ?? 1) < 0.55) inc(weak, q);
  }
  return Response.json({
    total: rows.length, answeredPct: rows.length ? Math.round(100 * rows.filter(r => r.answered).length / rows.length) : 0,
    topics: top(topics, 12), langs: top(langs, 5), days: [...days].sort().slice(-14),
    unanswered: top(unanswered, 30), weak: top(weak, 15),
  });
}
