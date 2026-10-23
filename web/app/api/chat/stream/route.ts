import { checkLimit, retrieve, compose, logQuestion, saveAnswer, ANSWER_PREVIEW_CHARS } from "@/lib/chatcore";
import { flag, isPremium } from "@/lib/server";
import { answerStream, llmConfigured } from "@/lib/llm";
import { validReplyLang } from "@/lib/lang";

function sessionIdOf(v: unknown) {
  return typeof v === "string" && v.length > 0 && v.length <= 64 ? v : null;
}

// SSE event order: "cards" (the sources) -> "token"* (the AI answer, streamed) ->
// "answer_done" (premium) or "answer_locked" (free preview) or "answer_rejected"
// (citation guard failed) -> "done". On failure the client falls back to the JSON /api/chat.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { q, lang = "en", anonId = null, sid = null, replyLang = "auto" } = await req.json();
  const L = ["en", "hi", "ur"].includes(lang) ? lang : "en";
  const RL = validReplyLang(replyLang);
  if (!q || typeof q !== "string" || q.length > 500) return Response.json({ error: "bad question" }, { status: 400 });
  const lim = await checkLimit(req, anonId);
  if (lim.blocked) return Response.json({ error: lim.message }, { status: 429 });
  const sessionId = sessionIdOf(sid);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const llmOn = (await flag("llm_answers")) && llmConfigured();
        const { ex, hits, history } = await retrieve(q, sessionId, { useLlm: llmOn });
        const cards = hits.length ? await compose(hits, L) : [];
        const logId = await logQuestion({ anonId, userId: lim.user?.id ?? null, lang: L, topic: ex.topic,
          question: q, answered: hits.length > 0, topSim: hits[0]?.sim ?? 0, topRef: hits[0]?.ref ?? null, sessionId });
        send("cards", { answered: hits.length > 0, cards, topic: ex.topic });
        if (cards.length && llmOn) {
          // Premium/trial: the full answer streams live. Free/anonymous: only a ~240-char
          // preview is streamed, then an "answer_locked" event carries the preview text.
          const premium = lim.user ? await isPremium(lim.user.id) : false;
          let sent = 0;
          const onToken = (t: string) => {
            if (premium) { send("token", { t }); return; }
            if (sent >= ANSWER_PREVIEW_CHARS) return;
            const room = ANSWER_PREVIEW_CHARS - sent;
            send("token", { t: t.slice(0, room) });
            sent += Math.min(t.length, room);
          };
          const { ok, text } = await answerStream(q, cards, history, RL, onToken);
          if (ok) {
            await saveAnswer(logId, text);
            if (premium) send("answer_done", { text });
            else send("answer_locked", { preview: text.slice(0, ANSWER_PREVIEW_CHARS).trimEnd() + (text.length > ANSWER_PREVIEW_CHARS ? "…" : "") });
          } else send("answer_rejected", {});
        }
        send("done", {});
      } catch {
        send("error", { error: "The server is busy right now. Please try again in a little while." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
}
