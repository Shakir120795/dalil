"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client";

const Rows = ({ rows }: { rows: [string, number][] }) => {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return <>{rows.map(([k, v]) => (
    <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: 8, margin: "4px 0" }}>
      <div style={{ background: `linear-gradient(90deg,#e3c27a55 ${(100 * v) / max}%,transparent 0)`, padding: "2px 6px", borderRadius: 4 }}>{k}</div><b>{v}</b></div>))}</>;
};

export default function Admin() {
  const [s, setS] = useState<any>(null); const [ex, setEx] = useState<any[]>([]); const [err, setErr] = useState("");
  const loadEx = () => authFetch("/api/admin/experts").then(r => r.json()).then(j => setEx(j.experts ?? []));
  useEffect(() => {
    authFetch("/api/admin/stats").then(async r => r.ok ? setS(await r.json()) : setErr("You don't have admin access.")); loadEx();
  }, []);
  async function toggle(e: any, k: "verified" | "active") {
    await authFetch("/api/admin/experts", { method: "POST", body: JSON.stringify({ id: e.id, verified: k === "verified" ? !e.verified : e.verified, active: k === "active" ? !e.active : e.active }) });
    loadEx();
  }
  if (err) return <main><p className="note">{err}</p></main>;
  if (!s) return <main><p className="note">Loading...</p></main>;
  return (
    <main>
      <h1>Admin: last 30 days</h1>
      <p className="sub">{s.total} questions · sources found for {s.answeredPct}%</p>
      <h2>Topics</h2><Rows rows={s.topics} />
      <h2>Language</h2><Rows rows={s.langs} />
      <h2>Questions per day</h2><Rows rows={s.days} />
      <h2>Unanswered (choose the next book from these)</h2><Rows rows={s.unanswered} />
      <h2>Weak matches (low similarity)</h2><Rows rows={s.weak} />
      <h2>Experts</h2>
      {ex.map(e => (
        <article className="card" key={e.id}><div className="ref">{e.name} · ₹{e.price_inr}{e.dua_price_inr ? ` · dua ₹${e.dua_price_inr}` : ""}</div>
          <div className="note">{e.credential}</div>
          <label><input type="checkbox" style={{ flex: "none" }} checked={e.verified} onChange={() => toggle(e, "verified")} /> Verified</label>{" "}
          <label><input type="checkbox" style={{ flex: "none" }} checked={e.active} onChange={() => toggle(e, "active")} /> Active</label></article>))}
    </main>
  );
}
