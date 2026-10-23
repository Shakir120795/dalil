"use client";
import { useEffect, useRef, useState } from "react";
import PrayerStrip from "@/modules/prayer/PrayerStrip";
import AuthBar from "@/modules/auth/AuthBar";
import { authFetch, sbc } from "@/lib/client";
import { followups } from "@/lib/followups";
import { REPLY_LANGS } from "@/lib/lang";
import { answerLangOptionsForRegion, regionByCode, effectiveAnswerLang, getPrefs, type Prefs } from "@/lib/region";
import ShareButtons from "@/modules/share/ShareButtons";
import type { ShareCardData } from "@/lib/shareCard";
import { useUiLang, type TFunc } from "@/lib/i18n";
import { fallbackChips } from "@/lib/topicQuestions";

type Card = { ref: string; source: string; english: string; arabic: string | null; translation: string | null; meta: any; context?: { ref: string; content: string }[] };
type Turn = { q: string; answer?: string; answerPreview?: string; answerLocked?: boolean; answered?: boolean; cards?: Card[]; error?: string; topic?: string; streaming?: boolean };
type Sugg = { label: string; question: string };
const suggOf = (c: { text: string; topic: string }): Sugg => ({ label: c.topic, question: c.text });
const DEFAULT_SUGGS: Sugg[] = fallbackChips("en").map(suggOf);
// Sample questions in other languages, to show that users can ask in their own language.
const LANG_EXAMPLES: { lang: string; dir?: "rtl"; text: string }[] = [
  { lang: "ur", dir: "rtl", text: "وضو کب ٹوٹتا ہے؟" },
  { lang: "hi", text: "नमाज़ का सही तरीका क्या है?" },
  { lang: "ar", dir: "rtl", text: "ما هي أركان الصلاة؟" },
];

// Sky colour by time of day (Fajr -> Isha)
function sky(h: number): [string, string] {
  if (h < 5) return ["#070d1a", "#14233a"];
  if (h < 7) return ["#1b2a4a", "#d98c5f"];
  if (h < 16) return ["#0f3a52", "#2f7f8f"];
  if (h < 19) return ["#2a2347", "#c9683f"];
  return ["#0c1626", "#1d3a4a"];
}
const fiqh = (c: Card) => c.source.startsWith("fiqh:");
const badge = (c: Card) => fiqh(c) ? "Fiqh" : c.source === "quran" ? "Quran" : "Hadith";
const badgeCls = (c: Card) => "badge" + (fiqh(c) ? " fiqh" : c.source === "quran" ? "" : " hadith");
const srcKind = (c: Card) => fiqh(c) ? "fiqh" : c.source === "quran" ? "quran" : "hadith";
const label = (c: Card) => fiqh(c) ? `${c.meta?.book ?? c.source.slice(5)} · ${c.ref.split(":").slice(1).join(":")}`
  : c.source === "quran" ? c.ref : `${c.source[0].toUpperCase() + c.source.slice(1)} #${c.ref.split(":")[1]}`;

function SourceCard({ c, lang, t }: { c: Card; lang: string; t: TFunc }) {
  const share: ShareCardData = { arabic: c.arabic, translation: c.translation, english: c.english, ref: label(c), badge: badge(c) };
  return (
    <article className="card">
      <div className="srchead"><span className={badgeCls(c)}>{badge(c)}</span>
        <span className="ref">{label(c)}{c.meta?.grades?.[0]?.grade ? ` · ${c.meta.grades[0].grade}` : ""}</span></div>
      {c.arabic && <div className="ar" lang="ar">{c.arabic}</div>}
      <div className="en">{c.english}</div>
      {fiqh(c) && <div className="note">{t("fiqh_note")}</div>}
      {c.translation && <div className={lang === "ur" ? "hi ur" : "hi"}>{c.translation}</div>}
      {!!c.context?.length && <details className="ctx"><summary>{t("nearby_verses")}</summary>
        {c.context.map(x => <p key={x.ref}><span className="ref">{x.ref}</span> {x.content}</p>)}</details>}
      <ShareButtons card={share} />
    </article>
  );
}

// Compact "Sources" row under an AI answer: one chip per source, tap to expand the full card.
function SourcesRow({ cards, lang, t }: { cards: Card[]; lang: string; t: TFunc }) {
  const [open, setOpen] = useState<string | null>(null);
  const key = (c: Card) => c.ref + c.source;
  const cur = cards.find(c => key(c) === open);
  return (
    <div className="sources">
      <div className="src-title">{t("sources")}</div>
      <div className="srcchips">
        {cards.map(c => (
          <button type="button" key={key(c)} className={"srcchip" + (open === key(c) ? " on" : "")}
            onClick={() => setOpen(open === key(c) ? null : key(c))} aria-expanded={open === key(c)}>
            <span className={"srcdot " + srcKind(c)} />{badge(c)} · {label(c)}
          </button>))}
      </div>
      {cur && <SourceCard c={cur} lang={lang} t={t} />}
    </div>
  );
}

function MicButton({ locale, onText, t }: { locale: string; onText: (t: string) => void; t: TFunc }) {
  const [on, setOn] = useState(false); const [nope, setNope] = useState(false);
  const rec = useRef<any>(null);
  function toggle() {
    if (on) { try { rec.current?.stop(); } catch {} setOn(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setNope(true); setTimeout(() => setNope(false), 2600); return; }
    const r = new SR();
    r.lang = locale;
    r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (e: any) => { let t = ""; for (const res of e.results) t += res[0].transcript; onText(t); };
    r.onend = () => setOn(false); r.onerror = () => setOn(false);
    rec.current = r;
    try { r.start(); setOn(true); } catch { setOn(false); }
  }
  return (<>
    <button type="button" className={"mic" + (on ? " live" : "")} onClick={toggle} aria-label={t("voice_input")}>🎙</button>
    {nope && <span className="micnope">{t("voice_unsupported")}</span>}
  </>);
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState("en"); const [replyLang, setReplyLang] = useState("auto");
  const [detName, setDetName] = useState("");
  const [regionCode, setRegionCode] = useState("IN");
  const [detVoice, setDetVoice] = useState("en-IN");
  const [initials, setInitials] = useState("👤");
  const [anonId, setAnonId] = useState(""); const [sid, setSid] = useState("");
  const [ayah, setAyah] = useState<{ ref: string; arabic: string | null; english: string } | null>(null);
  const [suggs, setSuggs] = useState<Sugg[]>(DEFAULT_SUGGS);
  const end = useRef<HTMLDivElement>(null); const seq = useRef(0); const gen = useRef(0);
  const prefsRef = useRef<Prefs | null>(null); const profApplied = useRef(false);
  // UI language follows the selected answer language (replyLang state wins;
  // Auto resolves via prefs). Also drives <html lang/dir> and the chips.
  const { lang: uiLang, t: tr } = useUiLang(replyLang === "auto" ? null : replyLang);
  const autoLabel = detName ? tr("auto_detected", { name: detName }) : tr("auto_match");

  useEffect(() => {
    const [a, b] = sky(new Date().getHours());
    document.documentElement.style.setProperty("--bg1", a); document.documentElement.style.setProperty("--bg2", b);
    let id = localStorage.getItem("anon"); if (!id) { id = crypto.randomUUID(); localStorage.setItem("anon", id); }
    setAnonId(id);
    // Region-based defaults: detected answer language (shown on the Auto option),
    // voice locale, and the translation default when the user has never picked one.
    const prefs = getPrefs(); prefsRef.current = prefs;
    setRegionCode(prefs.region);
    setDetVoice(prefs.detected.voiceLocale);
    const dn = REPLY_LANGS[prefs.detected.answerLang]?.name;
    if (dn) setDetName(dn);
    const storedLang = localStorage.getItem("lang");
    if (storedLang) setLang(storedLang);
    else { setLang(prefs.translationLang); localStorage.setItem("lang", prefs.translationLang); }
    setReplyLang(localStorage.getItem("dalil_reply_lang") || "auto");
    let s = localStorage.getItem("dalil_sid"); if (!s) { s = crypto.randomUUID(); localStorage.setItem("dalil_sid", s); }
    setSid(s);
    fetch("/api/ayah-of-day").then(r => r.ok ? r.json() : null)
      .then(j => { if (j && !j.error && j.english) setAyah(j); }).catch(() => {});
  }, []);

  // Smart suggestions in the UI language: localized defaults paint first
  // (no flash), then the log-based chips replace them.
  useEffect(() => {
    let alive = true;
    setSuggs(fallbackChips(uiLang).map(suggOf));
    fetch(`/api/suggestions?lang=${uiLang}`).then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && Array.isArray(j?.suggestions) && j.suggestions.length >= 3) setSuggs(j.suggestions); }).catch(() => {});
    return () => { alive = false; };
  }, [uiLang]);
  useEffect(() => { if (turns.length) end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  // Saved profile preferences win over local defaults — applied once per session, fail silently.
  useEffect(() => {
    if (profApplied.current) return; profApplied.current = true;
    authFetch("/api/profile").then(async r => {
      if (!r.ok) return;
      const d = await r.json();
      if (d.answer_lang) { setReplyLang(d.answer_lang); localStorage.setItem("dalil_reply_lang", d.answer_lang); }
      if (d.translation_lang) { setLang(d.translation_lang); localStorage.setItem("lang", d.translation_lang); }
      const src = (d.display_name || "").trim() || (d.email || "");
      if (src) setInitials(src.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase());
    }).catch(() => {});
  }, []);

  const patch = (idx: number, p: Partial<Turn>) => setTurns(t => t.map((x, i) => i === idx ? { ...x, ...p } : x));

  function newChat() {
    gen.current++;               // invalidate any in-flight stream patches
    seq.current = 0;
    const s = crypto.randomUUID();
    localStorage.setItem("dalil_sid", s); setSid(s);
    setTurns([]); setQ(""); setBusy(false);
  }

  // Voice recognition locale: an explicit answer-language choice wins (locale
  // from REPLY_LANGS); on Auto, use the detected region's locale.
  const voiceLocale = replyLang !== "auto" ? (REPLY_LANGS[replyLang]?.locale ?? "en-IN") : detVoice;

  // Region-aware answer-language options for the selector. A saved choice that
  // is outside the region list is still shown (marked current) so it never
  // silently disappears from the select.
  const regionLangOpts = answerLangOptionsForRegion(regionCode);
  const extraLangOpt = replyLang !== "auto" && !regionLangOpts.some(o => o.code === replyLang) && REPLY_LANGS[replyLang]
    ? [{ code: replyLang, name: `${REPLY_LANGS[replyLang].name} (current)` }] : [];

  // The replyLang sent to the API: explicit choice as-is; Auto = region-detected language.
  const effReply = () => replyLang !== "auto" ? replyLang
    : (prefsRef.current ? effectiveAnswerLang(prefsRef.current) : "auto");

  // Try streaming first; on failure, fall back to the JSON endpoint.
  async function submitStream(question: string, idx: number, g: number): Promise<boolean> {
    const p = (pp: Partial<Turn>) => { if (gen.current === g) patch(idx, pp); };
    try {
      const { data } = await sbc.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
      const r = await fetch("/api/chat/stream", { method: "POST", headers,
        body: JSON.stringify({ q: question, lang, anonId, sid, replyLang: effReply() }) });
      if (!r.ok || !r.body) return false;
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", ans = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const blocks = buf.split("\n\n"); buf = blocks.pop() ?? "";
        for (const b of blocks) {
          let ev = "", dd = "";
          for (const line of b.split("\n")) {
            if (line.startsWith("event:")) ev = line.slice(6).trim();
            else if (line.startsWith("data:")) dd += line.slice(5).trim();
          }
          if (!dd) continue;
          if (ev === "cards") { const j = JSON.parse(dd); p({ answered: j.answered, cards: j.cards, topic: j.topic }); }
          else if (ev === "token") { ans += (JSON.parse(dd) as { t: string }).t; p({ answer: ans }); }
          else if (ev === "answer_done") { const j = JSON.parse(dd) as { text: string }; ans = j.text; p({ answer: j.text }); }
          else if (ev === "answer_locked") { const j = JSON.parse(dd) as { preview: string };
            p({ answer: undefined, answerPreview: j.preview, answerLocked: true }); }
          else if (ev === "answer_rejected") p({ answer: undefined });
          else if (ev === "error") p({ error: (JSON.parse(dd) as { error: string }).error, answer: undefined });
        }
      }
      p({ streaming: false });
      return true;
    } catch { return false; }
  }

  async function submitJson(question: string, idx: number, g: number) {
    const p = (pp: Partial<Turn>) => { if (gen.current === g) patch(idx, pp); };
    try {
      const r = await authFetch("/api/chat", { method: "POST", body: JSON.stringify({ q: question, lang, anonId, sid, replyLang: effReply() }) });
      const j = await r.json();
      p(r.ok ? { answered: j.answered, cards: j.cards, answer: j.answer ?? undefined,
          answerPreview: j.answer_preview ?? undefined, answerLocked: !!j.answer_locked, topic: j.topic, streaming: false }
        : { error: j.error, streaming: false });
    } catch { p({ error: tr("network_error"), streaming: false }); }
  }

  async function submit(text: string) {
    const question = text.trim(); if (!question || busy) return;
    setQ(""); setBusy(true);
    const g = gen.current;
    const idx = seq.current++;
    setTurns(t => [...t, { q: question, streaming: true }]);
    if (!await submitStream(question, idx, g)) await submitJson(question, idx, g);
    if (gen.current === g) setBusy(false);
  }

  return (
    <main>
      <header className="top">
        <div className="brand"><span className="mark" lang="ar">دليل</span><span className="name">Dalil</span></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" className="newchat" onClick={newChat} disabled={!turns.length}>＋ {tr("new_chat")}</button>
          <a href="/profile" className="avatar havatar" aria-label={tr("profile_title")} title={tr("profile_title")}>{initials}</a>
        </div>
      </header>
      <div className="langbar">
        <label className="selwrap"><span>{tr("answer_language")}</span>
          <select value={replyLang} aria-label={tr("answer_language")}
            onChange={e => { setReplyLang(e.target.value); localStorage.setItem("dalil_reply_lang", e.target.value); }}>
            <option value="auto">{autoLabel}</option>
            <optgroup label={`Languages in ${regionByCode(regionCode).label}`}>
              {regionLangOpts.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
              {extraLangOpt.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="selwrap"><span>{tr("translation")}</span>
          <select value={lang} aria-label={tr("translation")} onChange={e => { setLang(e.target.value); localStorage.setItem("lang", e.target.value); }}>
            <option value="en">English</option><option value="hi">English + Hindi</option><option value="ur">English + Urdu</option>
          </select>
        </label>
      </div>
      <p className="tag">{tr("tagline")}</p>
      <AuthBar />
      <PrayerStrip />

      {turns.length === 0 && (
        <section className="hero">
          {ayah && (
            <div className="daily-ayah">
              <div className="da-label">✦ {tr("ayah_of_day")}</div>
              {ayah.arabic && <div className="ar" lang="ar">{ayah.arabic}</div>}
              <div className="da-en">{ayah.english}</div>
              <span className="ref">Quran {ayah.ref}</span>
              <ShareButtons card={{ arabic: ayah.arabic, translation: null, english: ayah.english, ref: `Quran ${ayah.ref}`, badge: "Quran" }} />
            </div>
          )}
          <h2>{tr("hero_title")}</h2>
          <p>{tr("hero_text")}</p>
          <div className="chips">{suggs.map(s => <button key={s.question} className="chip" onClick={() => submit(s.question)}><small>{s.label}</small>{s.question}</button>)}</div>
          <p className="trylangs">{tr("try_asking_lang")}</p>
          <div className="langchips">{LANG_EXAMPLES.map(x => (
            <button key={x.text} type="button" className="langchip" lang={x.lang} dir={x.dir ?? "ltr"} onClick={() => submit(x.text)}>{x.text}</button>))}
          </div>
        </section>
      )}

      {turns.map((t, i) => (
        <section className="turn" key={i}>
          <div className="msg-q">{t.q}</div>
          <div className="msg-a">
            {t.streaming && !t.answer && !t.answerPreview && !t.error && t.answered !== false && (
              <div className="typing" aria-live="polite"><span /><span /><span /></div>)}
            {t.error && <p className="note">{t.error}</p>}
            {t.error && /limit/i.test(t.error) && (
              <p><a className="upbtn" href="/upgrade">⭐ {tr("upgrade_premium")}</a></p>)}
            {t.answered === false && !t.streaming && <p className="note">{tr("no_answer")}</p>}

            {(t.answer || t.answerLocked) && (
              <div className="ai">
                <div className="ai-label">✦ Dalil AI</div>
                {t.answer && <div className="ai-body">{t.answer}</div>}
                {t.answerLocked && t.answerPreview && (<>
                  <div className="ai-body sumprev">{t.answerPreview}</div>
                  <div className="lockcta"><span>🔒 {tr("premium_lock")}</span>
                    <a className="upbtn" href="/upgrade">{tr("unlock_full")}</a></div>
                </>)}
                <div className="note">{tr("not_fatwa")}</div>
              </div>
            )}
            {(t.answer || t.answerLocked) && !!t.cards?.length && <SourcesRow cards={t.cards} lang={lang} t={tr} />}

            {!t.streaming && t.answered && !t.answer && !t.answerLocked && !!t.cards?.length && (<>
              <p className="note">{tr("no_ai_answer")}</p>
              {t.cards.map(c => <SourceCard key={c.ref + c.source} c={c} lang={lang} t={tr} />)}
            </>)}

            {!t.streaming && t.answered && t.topic && (
              <div className="fups">{followups(t.topic).map(f => (
                <button key={f} className="fup" onClick={() => submit(f)}>{f}</button>))}</div>)}
          </div>
        </section>
      ))}
      <p className="note foot"><a href="/about">{tr("footer_about")}</a> · <a href="/attribution">{tr("sources")}</a> · <a href="/privacy">{tr("footer_privacy")}</a> · <a href="/terms">{tr("footer_terms")}</a> · <a href="/refund">{tr("footer_refunds")}</a></p>
      <div ref={end} />

      <form className="chatbar" onSubmit={e => { e.preventDefault(); submit(q); }}><div className="row">
        <MicButton locale={voiceLocale} onText={setQ} t={tr} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr("ask_placeholder")} maxLength={500} aria-label={tr("your_question")} />
        <button disabled={busy || !q.trim()} aria-label="Send">{tr("ask_button")}</button>
      </div></form>
    </main>
  );
}
