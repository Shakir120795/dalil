import { sb } from "@/lib/server";
import {
  TOPICS, POPULAR_LABEL,
  fallbackChips, canonicalChip, pick, validUiLang, type Topic,
} from "@/lib/topicQuestions";

export const dynamic = "force-dynamic";

// Smart "Try asking" chips: jo sawal log asal me sabse zyada poochte hain
// (questions_log se), wahi suggestions bante hain — har visit par thoda
// rotation ke saath, taaki list hamesha ek jaisi na lage.
// ?lang= (Phase 12): canonical topic sawal + labels UI language me aate hain;
// asal user sawal (log se) waise ke waise rehte hain — woh pehle se users ki
// apni bhasha me hote hain.

type Sugg = { label: string; question: string };

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[?.!]+\s*$/, "");

// Asal user sawal public chip me tabhi dikhega jab woh personal na ho.
function isSafePublicQuestion(raw: string): boolean {
  const q = raw.trim();
  if (q.length < 10 || q.length > 90) return false;
  const l = q.toLowerCase();
  if (/@/.test(q) || /\d{5,}/.test(q)) return false;                    // email / phone jaisi cheez
  if (/\b(my|mere|mera|meri)\b/.test(l)) return false;
  if (/\bi am\b/.test(l) || /\bmy name\b/.test(l)) return false;
  if (/https?:\/\//.test(l)) return false;
  return true;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function reply(suggestions: Sugg[]) {
  return Response.json({ suggestions }, { headers: { "Cache-Control": "private, max-age=300" } });
}

export async function GET(req: Request) {
  const lang = validUiLang(new URL(req.url).searchParams.get("lang"));
  const FALLBACK: Sugg[] = fallbackChips(lang).map(c => ({ label: c.topic, question: c.text }));
  try {
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data, error } = await sb.from("questions_log")
      .select("topic,question")
      .eq("answered", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error || !data) return reply(FALLBACK);

    const rows = data as { topic: string | null; question: string | null }[];
    if (rows.length < 20) return reply(FALLBACK);   // log chhota hai -> static list hi sahi

    // (a) Sabse common topics — canonical sawal UI language me
    const topicCount = new Map<string, number>();
    for (const r of rows) {
      if (r.topic && (TOPICS as readonly string[]).includes(r.topic)) topicCount.set(r.topic, (topicCount.get(r.topic) ?? 0) + 1);
    }
    const rankedTopics: Sugg[] = [...topicCount.entries()].sort((a, b) => b[1] - a[1])
      .map(([t]) => { const c = canonicalChip(t as Topic, lang); return { label: c.topic, question: c.text }; });

    // (b) Asal bar bar pooche gaye sawal (safe wale hi) — jaise ke taise
    const freq = new Map<string, { count: number; variants: Map<string, number> }>();
    for (const r of rows) {
      if (!r.question) continue;
      const key = norm(r.question);
      if (!key) continue;
      const e = freq.get(key) ?? { count: 0, variants: new Map<string, number>() };
      e.count++;
      const v = r.question.trim();
      e.variants.set(v, (e.variants.get(v) ?? 0) + 1);
      freq.set(key, e);
    }
    const seenQ = new Set<string>(rankedTopics.map(t => norm(t.question)));
    const popularLabel = pick(POPULAR_LABEL, lang);
    const realQs: Sugg[] = [...freq.entries()]
      .filter(([, e]) => e.count >= 3)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([, e]) => [...e.variants.entries()].sort((a, b) => b[1] - a[1])[0][0])
      .filter(q => isSafePublicQuestion(q) && !seenQ.has(norm(q)))
      .slice(0, 2)
      .map(q => { seenQ.add(norm(q)); return { label: popularLabel, question: q }; });

    // List banana: pehle top-2 topics, phir asal frequent sawal, phir bachi
    // jagah baaki topics (rotated) aur zarurat par fallback se.
    const head = rankedTopics.slice(0, 2);
    const fillers = shuffle(rankedTopics.slice(2))
      .filter(t => !realQs.some(r => norm(r.question) === norm(t.question)));
    const tail: Sugg[] = [...realQs, ...fillers];
    for (const f of FALLBACK) {
      if (head.length + tail.length >= 6) break;
      if (!head.some(h => norm(h.question) === norm(f.question)) && !tail.some(t => norm(t.question) === norm(f.question)))
        tail.push(f);
    }
    // Top-2 fix rehte hain; uske baad ke items har request par shuffle — variety ke liye.
    const suggestions = [...head, ...shuffle(tail)].slice(0, 6);
    return reply(suggestions.length >= 3 ? suggestions : FALLBACK);
  } catch {
    return reply(FALLBACK);
  }
}
