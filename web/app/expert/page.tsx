"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client";

type TQ = { id: string; question: string; answer: string | null; status: string; created_at: string; answered_at: string | null };

export default function ExpertPanel() {
  const [list, setList] = useState<any[] | null>(null); const [tqs, setTqs] = useState<TQ[] | null>(null);
  const [err, setErr] = useState(""); const [ans, setAns] = useState<Record<string, string>>({});

  const load = () => authFetch("/api/expert/panel").then(async r => {
    const j = await r.json();
    if (r.ok) { setList(j.bookings); setTqs(j.textQuestions ?? []); } else setErr(j.error);
  });
  useEffect(() => { load(); }, []);

  async function done(id: string) { await authFetch("/api/expert/panel", { method: "POST", body: JSON.stringify({ booking_id: id }) }); load(); }
  async function answer(id: string) {
    const a = (ans[id] || "").trim(); if (a.length < 5) return;
    const r = await authFetch("/api/expert/answer", { method: "POST", body: JSON.stringify({ question_id: id, answer: a }) });
    if (r.ok) { setAns(s => ({ ...s, [id]: "" })); load(); }
  }

  if (err) return <main><p className="note">{err}</p></main>;
  if (!list) return <main><p className="note">Loading...</p></main>;
  return (
    <main>
      <div className="pagehead"><h1>Expert panel</h1><p>Bookings and written questions — all in one place.</p></div>

      <h2>✍️ Questions asked in writing</h2>
      {!tqs?.length && <p className="note">No written questions yet.</p>}
      {tqs?.map(x => (
        <article className="card etq" key={x.id}>
          <div className="q">{x.question}<span className={"pill " + x.status}>{x.status}</span></div>
          <div className="note">{new Date(x.created_at).toLocaleString()}</div>
          {x.answer ? <div className="ans"><div className="ref">Your answer</div><div>{x.answer}</div></div> : (
            <div className="answerbox" style={{ marginTop: 8 }}>
              <textarea value={ans[x.id] || ""} onChange={e => setAns(s => ({ ...s, [x.id]: e.target.value }))}
                rows={3} maxLength={2000} placeholder="Write your answer" />
              <button style={{ marginTop: 8, padding: "8px 18px" }} disabled={(ans[x.id] || "").trim().length < 5}
                onClick={() => answer(x.id)}>Send answer</button>
            </div>)}
        </article>))}

      <h2>🎓 Bookings</h2>
      {!list.length && <p className="note">No paid requests yet.</p>}
      {list.map(b => (
        <article className="card" key={b.id}>
          <div className="ref">{b.type === "dua_request" ? "Dua request" : "Session"} · {b.status} · ₹{b.amount_inr}</div>
          {b.scheduled_at && <div>{new Date(b.scheduled_at).toLocaleString()}</div>}
          {b.notes && <div>{b.notes}</div>}{b.meeting_url && <a href={b.meeting_url}>Call link</a>}
          {b.status === "paid" && <div><button style={{ marginTop: 8, padding: "8px 16px" }} onClick={() => done(b.id)}>{b.type === "dua_request" ? "Mark dua done" : "Mark session done"}</button></div>}
        </article>))}
    </main>
  );
}
