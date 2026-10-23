"use client";
import { useEffect, useState } from "react";
import { authFetch, checkout, sbc } from "@/lib/client";
import { useUiLang } from "@/lib/i18n";

type Q = { id: string; question: string; answer: string | null; status: string; created_at: string; answered_at: string | null; expert: { name: string } | null };

export default function Experts() {
  const { t } = useUiLang();
  const [d, setD] = useState<any>(null); const [when, setWhen] = useState(""); const [msg, setMsg] = useState("");
  const [qs, setQs] = useState<Q[] | null>(null);
  const [askExpert, setAskExpert] = useState(""); const [askText, setAskText] = useState(""); const [askMsg, setAskMsg] = useState("");

  const load = () => authFetch("/api/experts").then(r => r.json()).then(setD);
  const loadQs = () => authFetch("/api/experts/questions").then(async r => {
    if (!r.ok) return setQs([]);
    const j = await r.json(); setQs(j.questions);
    localStorage.setItem("etq_seen", String(Date.now()));  // jawab dekh liye: unread dot hatao
  });
  useEffect(() => { load(); loadQs(); }, []);

  async function book(id: string) {
    setMsg("");
    const r = await authFetch("/api/experts/book", { method: "POST", body: JSON.stringify({ expert_id: id, scheduled_at: when }) });
    const o = await r.json(); if (!r.ok) return setMsg(o.error);
    const email = (await sbc.auth.getSession()).data.session?.user.email;
    checkout(o, email, ok => { setMsg(ok ? t("booking_confirmed") : t("payment_unverified")); load(); });
  }
  async function ask() {
    setAskMsg("");
    const r = await authFetch("/api/experts/ask", { method: "POST", body: JSON.stringify({ expert_id: askExpert, question: askText }) });
    const o = await r.json();
    if (!r.ok) return setAskMsg(o.error);
    setAskText(""); setAskMsg(t("question_sent")); loadQs();
  }

  if (!d) return <main><p className="note">{t("loading_word")}</p></main>;
  if (!d.enabled) return <main><div className="pagehead"><h1>{t("nav_experts")}</h1></div>
    <p className="note">{t("experts_soon")}</p></main>;

  return (
    <main>
      <div className="pagehead"><h1>{t("experts_title")}</h1><p>{t("experts_sub")}</p></div>

      <h2>🎓 {t("book_session")}</h2>
      <p className="sub">{t("book_sub")}</p>
      <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} aria-label={t("session_time")} style={{ width: "100%", marginBottom: 12 }} />
      {d.experts.map((x: any) => (
        <article className="card expert-card" key={x.id}>
          <div className="avatar">{(x.name || "A")[0]}</div>
          <div className="xbody">
            <div className="ref">{x.name} · ₹{x.price_inr}</div>
            <div>{x.bio}</div><div className="note">{x.credential} · {x.madhab} · {(x.languages || []).join(", ")}</div>
            <button style={{ marginTop: 8, padding: "8px 16px" }} disabled={!when || !d.paymentsOn} onClick={() => book(x.id)}>{t("book_word")}</button>
          </div>
        </article>
      ))}
      {!!d.mine?.length && <><h2>{t("my_bookings")}</h2>{d.mine.map((b: any) => (
        <article className="card" key={b.id}><div className="ref">{b.status}</div>
          <div>{b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : ""}</div>
          {b.meeting_url && <a href={b.meeting_url}>{t("join_call")}</a>}</article>))}</>}
      {msg && <p className="note">{msg}</p>}

      <h2>✍️ {t("ask_written")}</h2>
      <p className="sub">{t("ask_sub")}</p>
      <div className="askbox">
        <select value={askExpert} onChange={e => setAskExpert(e.target.value)} aria-label={t("choose_expert")}>
          <option value="">{t("choose_expert")}</option>
          {d.experts.map((x: any) => <option key={x.id} value={x.id}>{x.name} · {x.madhab}</option>)}
        </select>
        <textarea value={askText} onChange={e => setAskText(e.target.value)} maxLength={1000} rows={3}
          placeholder={t("write_question")} />
        <button style={{ marginTop: 8, padding: "8px 18px" }} disabled={!askExpert || askText.trim().length < 5} onClick={ask}>{t("send_question")}</button>
        {askMsg && <p className="note">{askMsg}</p>}
      </div>

      <h2>{t("my_questions")}</h2>
      {!qs && <p className="note">{t("loading_word")}</p>}
      {qs && !qs.length && <p className="note">{t("no_questions")}</p>}
      {qs?.map(x => (
        <article className="card etq" key={x.id}>
          <div className="q">{x.question}<span className={"pill " + x.status}>{x.status === "answered" ? t("answered_word") : t("awaiting_reply")}</span></div>
          <div className="note">{x.expert?.name} · {new Date(x.created_at).toLocaleString()}</div>
          {x.answer && <div className="ans"><div className="ref">{t("expert_reply")}</div><div>{x.answer}</div></div>}
        </article>))}
    </main>
  );
}
