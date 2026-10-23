// Optional: OpenAI-compatible endpoint (Groq, Ollama, OpenRouter...). Runs only when the
// 'llm_answers' feature flag is on. The AI answer is composed ONLY from retrieved sources,
// and a citation guard drops any answer that cites none of them.
import { REPLY_LANGS } from "@/lib/lang";

const SYSTEM = `You are Dalil, an AI assistant for Islamic questions. Answer the user's question conversationally and clearly, using ONLY the sources provided (Quran, Hadith and fiqh books).
Cite every factual claim with [ref] exactly as given in the sources. Never issue a personal fatwa or ruling: present what the sources say, and for personal rulings advise consulting a scholar.
Reply in the SAME language and script as the user's latest question.
If the sources do not answer the question, say so plainly in the user's language and suggest asking an expert instead.
Use short paragraphs. Do not invent references.`;

export type CardIn = { ref: string; english: string };
export type HistIn = { q: string; answer: string };

function conf() {
  return { base: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL, key: process.env.LLM_API_KEY ?? "" };
}

export function llmConfigured() {
  const { base, model } = conf();
  return !!base && !!model;
}

function systemPrompt(replyLang: string) {
  if (replyLang === "hinglish") {
    return SYSTEM + `\nThe user has selected the reply language: Hinglish. Write your entire reply in Hinglish — Hindi written in the Roman (Latin) script, in a natural conversational style — whatever language the question is in.`;
  }
  if (replyLang && replyLang !== "auto" && REPLY_LANGS[replyLang]) {
    return SYSTEM + `\nThe user has selected the reply language: ${REPLY_LANGS[replyLang].name}. Write your entire reply in that language and its usual script, whatever language the question is in.`;
  }
  return SYSTEM;
}

function messages(q: string, cards: CardIn[], history: HistIn[], replyLang: string) {
  const src = cards.slice(0, 5).map(c => `[${c.ref}] ${c.english.slice(0, 700)}`).join("\n\n");
  const m: { role: string; content: string }[] = [{ role: "system", content: systemPrompt(replyLang) }];
  for (const h of history.slice(-2)) {
    m.push({ role: "user", content: h.q }, { role: "assistant", content: h.answer });
  }
  m.push({ role: "user", content: `Question: ${q}\n\nSources:\n${src}` });
  return m;
}

function guarded(cards: CardIn[], text: string) {
  text = text.trim();
  // Citation guard: at least one provided source must be cited, otherwise drop the answer.
  return cards.some(c => text.includes(`[${c.ref}]`)) ? text : "";
}

export async function answer(q: string, cards: CardIn[], history: HistIn[] = [], replyLang = "auto") {
  const { base, model, key } = conf();
  if (!base || !model) return null;
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 500, messages: messages(q, cards, history, replyLang) }),
    });
    if (!r.ok) return null;
    const text: string = (await r.json()).choices?.[0]?.message?.content?.trim() ?? "";
    return guarded(cards, text) || null;
  } catch { return null; }
}

// Streaming variant: tokens are forwarded via onToken() as they arrive. The citation guard
// runs at the end; on failure it returns ok:false and the client must drop the streamed text.
export async function answerStream(q: string, cards: CardIn[], history: HistIn[] = [], replyLang = "auto",
  onToken: (t: string) => void = () => {}): Promise<{ ok: boolean; text: string }> {
  const { base, model, key } = conf();
  if (!base || !model) return { ok: false, text: "" };
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(60000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 500, stream: true, messages: messages(q, cards, history, replyLang) }),
    });
    if (!r.ok || !r.body) return { ok: false, text: "" };
    const reader = r.body.getReader(); const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
      for (const p of parts) for (const line of p.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const delta: string = JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
          if (delta) { text += delta; onToken(delta); }
        } catch { /* partial chunk: completed on the next read */ }
      }
    }
    const g = guarded(cards, text);
    return g ? { ok: true, text: g } : { ok: false, text: "" };
  } catch { return { ok: false, text: "" }; }
}

// Translate a non-English question into English for retrieval (the corpus is English).
// Short, single-purpose call; any failure returns null and retrieval uses the raw question.
export async function translateToEnglish(q: string): Promise<string | null> {
  const { base, model, key } = conf();
  if (!base || !model) return null;
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 220, messages: [
        { role: "system", content: "Translate the user's question about Islam into clear, simple English. Keep common Islamic terms in their usual English transliteration (wudu, salah, zakat, sawm). Return ONLY the translation — no quotes, no explanation." },
        { role: "user", content: q },
      ] }),
    });
    if (!r.ok) return null;
    const t: string = (await r.json()).choices?.[0]?.message?.content?.trim() ?? "";
    return t.length > 1 ? t.slice(0, 500) : null;
  } catch { return null; }
}
