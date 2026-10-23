import { sb, userFromReq, planOf, isPremium } from "@/lib/server";
import { expand } from "@/lib/synonyms";
import { detectLang } from "@/lib/lang";
import { translateToEnglish } from "@/lib/llm";

const MIN_SIM = Number(process.env.MIN_SIM ?? 0.45);

export function normalizeQuery(t: string) {
  return t.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 500);
}

async function embedRemote(text: string): Promise<number[]> {
  const r = await fetch(`${process.env.EMBED_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.EMBED_TOKEN ?? ""}` },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error("embed service down");
  return (await r.json()).embedding;
}

// Embedding cache: pehle Supabase me dekho, miss par HF Space, phir cache me daalo.
export async function embed(text: string): Promise<number[]> {
  const key = normalizeQuery(text);
  if (key) {
    try {
      const { data } = await sb.from("embedding_cache").select("embedding,hits").eq("normalized_text", key).maybeSingle();
      if (data?.embedding) {
        const vec = typeof data.embedding === "string" ? JSON.parse(data.embedding) : data.embedding;
        sb.from("embedding_cache").update({ hits: (data.hits ?? 0) + 1 }).eq("normalized_text", key).then(() => {}, () => {});
        return vec;
      }
    } catch { /* table nahi hai ya miss: remote se lo */ }
  }
  const vec = await embedRemote(text);
  if (key) {
    try { await sb.from("embedding_cache").insert({ normalized_text: key, embedding: vec }); }
    catch { /* race me duplicate: ignore */ }
  }
  return vec;
}

// Follow-up pehchano: "iski", "aur", bahut chhota sawal, waghera
const FOLLOWUP_RE = /(^|\s)(aur|iski|iska|is\s*ka|ye|yeh|uska|uski|unka|unki|iska\s*matlab|is\s*liye|toh?\s*phir|phir)(\s|$|[?.!])/i;
export function isFollowUp(q: string, prevQ: string | null) {
  if (!prevQ) return false;
  return FOLLOWUP_RE.test(q) || q.trim().split(/\s+/).filter(Boolean).length <= 3;
}

export type HistTurn = { q: string; answer: string };

// Last 2 turns of the session, as context for the AI answer
// (the composed answer text is stored in questions_log.summary — column name kept from Phase 5).
export async function getHistory(sessionId: string | null): Promise<HistTurn[]> {
  if (!sessionId) return [];
  try {
    const { data } = await sb.from("questions_log").select("question,summary").eq("session_id", sessionId)
      .not("summary", "is", null).order("created_at", { ascending: false }).limit(2);
    return (data ?? []).reverse().map(d => ({ q: d.question as string, answer: d.summary as string }));
  } catch { return []; }  // if migration 005 has not run, skip memory
}

// retrieve + compose alag hain: baad me LLM lagana ho to sirf compose() badlega
// Retrieval: when the LLM is enabled and the question is not English, translate it to English
// first (the corpus is English) and search with the translation; bge-m3 is cross-lingual, so
// any translation failure simply falls back to the raw question.
export async function retrieve(q: string, sessionId: string | null, opts: { useLlm?: boolean } = {}) {
  const history = await getHistory(sessionId);
  const prevQ = history.length ? history[history.length - 1].q : null;
  const fu = isFollowUp(q, prevQ);
  const det = detectLang(q);
  let searchQ = q;
  if (opts.useLlm && det.needsTranslation) {
    const t = await translateToEnglish(q);
    if (t) searchQ = t;
  }
  const searchText = fu && prevQ ? `${prevQ} ${searchQ}` : searchQ;
  const ex = expand(searchText);
  const vec = await embed(ex.text || searchText);
  const { data, error } = await sb.rpc("match_hybrid", { q: vec, qtext: ex.tsquery, n: 5 });
  if (error) throw error;
  return { ex, hits: (data ?? []).filter((h: any) => h.sim >= MIN_SIM), history, followUp: fu,
    qLang: det.guess, translated: searchQ !== q ? searchQ : null };
}

export async function compose(hits: any[], lang: string) {
  const refs = hits.map((h) => h.ref);
  const langs = lang === "en" ? ["ar"] : ["ar", lang];
  const { data: disp } = await sb.from("display").select("ref,lang,content").in("ref", refs).in("lang", langs);
  // Quran: aas-paas ki 1 ayat pehle/baad (same surah) context ke liye
  const near = (ref: string) => { const [a, b] = ref.split(":").map(Number); return [`${a}:${b - 1}`, `${a}:${b + 1}`]; };
  const qRefs = hits.filter((h) => h.source === "quran").flatMap((h) => near(h.ref));
  const { data: ctx } = qRefs.length
    ? await sb.from("chunks").select("ref,content").eq("source", "quran").in("ref", qRefs) : { data: [] };
  return hits.map((h) => ({
    context: h.source === "quran" ? (ctx ?? []).filter((c) => near(h.ref).includes(c.ref))
      .sort((x, y) => Number(x.ref.split(":")[1]) - Number(y.ref.split(":")[1])) : [],
    ref: h.ref, source: h.source, english: h.content, meta: h.meta, sim: Number(h.sim.toFixed(2)),
    arabic: disp?.find((d) => d.ref === h.ref && d.lang === "ar")?.content ?? null,
    translation: lang === "en" ? null : disp?.find((d) => d.ref === h.ref && d.lang === lang)?.content ?? null,
  }));
}

export async function checkLimit(req: Request, anonId: string | null) {
  const user = await userFromReq(req);
  const limit = user ? ((await planOf(user.id))?.daily_chat_limit ?? null) : 10;   // null = unlimited
  if (limit !== null && (user || anonId)) {
    const day = new Date(); day.setUTCHours(0, 0, 0, 0);
    const { count } = await sb.from("questions_log").select("id", { count: "exact", head: true })
      .gte("created_at", day.toISOString()).eq(user ? "user_id" : "anon_id", user ? user.id : anonId);
    if ((count ?? 0) >= limit) return { blocked: true as const, user,
      message: user ? "You've reached today's question limit. Get Premium, or try again tomorrow." : "You've reached today's free limit. Please log in to continue." };
  }
  return { blocked: false as const, user };
}

export async function logQuestion(o: { anonId: string | null; userId: string | null; lang: string; topic: string;
  question: string; answered: boolean; topSim: number; topRef: string | null; sessionId: string | null }): Promise<number | null> {
  const row: any = { anon_id: o.anonId, user_id: o.userId, lang: o.lang, topic: o.topic, question: o.question,
    answered: o.answered, top_sim: o.topSim, top_ref: o.topRef, session_id: o.sessionId, summary: null };
  let r = await sb.from("questions_log").insert(row).select("id").single();
  if (r.error) {  // migration 005 na chali ho to purane columns se kaam chalao
    delete row.session_id; delete row.summary;
    r = await sb.from("questions_log").insert(row).select("id").single();
  }
  return r.data?.id ?? null;
}

export async function saveAnswer(id: number | null, answerText: string) {
  if (!id) return;
  try { await sb.from("questions_log").update({ summary: answerText }).eq("id", id); } catch { /* column missing: ignore */ }
}

// Premium gating: free/anonymous users see only a preview of the AI answer,
// premium/trial users get it in full. (The source cards themselves are always free.)
export const ANSWER_PREVIEW_CHARS = 240;
export async function gateAnswer(userId: string | null, answerText: string | null) {
  if (!answerText) return { answer: null as string | null, answer_preview: null as string | null, answer_locked: false };
  if (userId && (await isPremium(userId)))
    return { answer: answerText, answer_preview: null as string | null, answer_locked: false };
  return { answer: null as string | null, answer_locked: true,
    answer_preview: answerText.slice(0, ANSWER_PREVIEW_CHARS).trimEnd() + "…" };
}
