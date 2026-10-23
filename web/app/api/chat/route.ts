import { checkLimit, retrieve, compose, logQuestion, saveAnswer, gateAnswer } from "@/lib/chatcore";
import { flag } from "@/lib/server";
import { answer, llmConfigured } from "@/lib/llm";
import { validReplyLang } from "@/lib/lang";

function sessionIdOf(v: unknown) {
  return typeof v === "string" && v.length > 0 && v.length <= 64 ? v : null;
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { q, lang = "en", anonId = null, sid = null, replyLang = "auto" } = await req.json();
  const L = ["en", "hi", "ur"].includes(lang) ? lang : "en";
  const RL = validReplyLang(replyLang);
  if (!q || typeof q !== "string" || q.length > 500) return Response.json({ error: "bad question" }, { status: 400 });
  const lim = await checkLimit(req, anonId);
  if (lim.blocked) return Response.json({ error: lim.message }, { status: 429 });
  const sessionId = sessionIdOf(sid);
  try {
    const llmOn = (await flag("llm_answers")) && llmConfigured();
    const { ex, hits, history } = await retrieve(q, sessionId, { useLlm: llmOn });
    const cards = hits.length ? await compose(hits, L) : [];
    const logId = await logQuestion({ anonId, userId: lim.user?.id ?? null, lang: L, topic: ex.topic,
      question: q, answered: hits.length > 0, topSim: hits[0]?.sim ?? 0, topRef: hits[0]?.ref ?? null, sessionId });
    const ans = cards.length && llmOn ? await answer(q, cards, history, RL) : null;
    if (ans) await saveAnswer(logId, ans);
    const gated = await gateAnswer(lim.user?.id ?? null, ans);
    return Response.json({ answered: hits.length > 0, cards, answer: gated.answer,
      answer_preview: gated.answer_preview, answer_locked: gated.answer_locked, topic: ex.topic });
  } catch (e: any) {
    console.error("chat error:", e);
    return Response.json({ error: "The server is busy right now. Please try again in a little while." }, { status: 503 });
  }
}
