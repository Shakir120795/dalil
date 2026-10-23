"use client";
import { useEffect, useState } from "react";
import { authFetch, checkout, sbc } from "@/lib/client";
import { useUiLang } from "@/lib/i18n";

export default function Dua() {
  const { t } = useUiLang();
  const [d, setD] = useState<any>(null); const [text, setText] = useState(""); const [msg, setMsg] = useState("");
  const load = () => authFetch("/api/experts").then(r => r.json()).then(setD);
  useEffect(() => { load(); }, []);
  async function send(id: string) {
    setMsg("");
    const r = await authFetch("/api/dua", { method: "POST", body: JSON.stringify({ expert_id: id, intention: text }) }); const o = await r.json();
    if (!r.ok) return setMsg(o.error);
    const email = (await sbc.auth.getSession()).data.session?.user.email;
    checkout(o, email, ok => { setMsg(ok ? t("dua_sent") : t("payment_unverified")); setText(""); load(); });
  }
  if (!d) return <main><p className="note">{t("loading_word")}</p></main>;
  if (!d.enabled) return <main><h1>{t("dua_request")}</h1><p className="note">{t("dua_soon")}</p></main>;
  const dua = (d.experts || []).filter((x: any) => x.dua_price_inr);
  return (
    <main>
      <h1>{t("dua_request")}</h1>
      <p className="sub">{t("dua_sub")}</p>
      <textarea value={text} onChange={e => setText(e.target.value)} maxLength={500} rows={4} placeholder={t("write_intention")}
        style={{ width: "100%", padding: 12, borderRadius: 12, background: "#0c1626cc", color: "inherit", border: "1px solid #ffffff30", font: "inherit" }} />
      {dua.map((x: any) => (
        <article className="card" key={x.id}><div className="ref">{x.name} · ₹{x.dua_price_inr}</div><div className="note">{x.credential}</div>
          <button style={{ marginTop: 8, padding: "8px 16px" }} disabled={text.trim().length < 3 || !d.paymentsOn} onClick={() => send(x.id)}>{t("send_request")}</button></article>))}
      {(d.mine || []).filter((b: any) => b.type === "dua_request").map((b: any) => (
        <article className="card" key={b.id}><div className="ref">{b.status === "completed" ? t("dua_done") : b.status}</div>
          {b.completed_at && <div className="note">{new Date(b.completed_at).toLocaleString()}</div>}</article>))}
      {msg && <p className="note">{msg}</p>}<p className="note"><a href="/">{t("back_chat")}</a></p>
    </main>
  );
}
