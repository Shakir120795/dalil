"use client";
import { useEffect, useState } from "react";
import { authFetch, checkoutSub, sbc } from "@/lib/client";
import { useUiLang, type TFunc } from "@/lib/i18n";
import { REPLY_LANGS } from "@/lib/lang";

type Status = { loggedIn: boolean; plan_code: string; status: string;
  current_period_end: string | null; trial_end: string | null;
  cancel_at_period_end: boolean; trial_claimed: boolean };

// [feature, free value, premium value, free-value-counts-as-good]
function features(t: TFunc): [string, string, string, boolean][] {
  return [
    [t("f_q_per_day"), "30", t("v_unlimited"), false],
    [t("f_ai"), t("v_preview"), t("v_full"), false],
    [t("f_share"), t("v_watermark"), t("v_no_watermark"), false],
    [t("f_expert_q"), t("v_1_month"), t("v_10_month"), false],
    [t("f_video"), t("v_fullprice"), t("v_10off"), false],
    [t("f_sources"), "✓", "✓", true],
    [t("f_tools"), "✓", "✓", true],
  ];
}

export default function Upgrade() {
  const { lang: uiLang, t } = useUiLang();
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(REPLY_LANGS[uiLang]?.locale ?? "en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
  const FEATURES = features(t);
  const [st, setSt] = useState<Status | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  const load = () => authFetch("/api/subscribe/status").then(r => r.json()).then(setSt).catch(() => {});
  useEffect(() => { load(); }, []);

  const premium = !!st?.loggedIn && st.plan_code !== "free";
  const planCode = cycle === "monthly" ? "premium_monthly" : "premium_yearly";

  async function startTrial() {
    setBusy(true); setMsg("");
    const r = await authFetch("/api/subscribe/trial", { method: "POST", body: "{}" }); const o = await r.json();
    setBusy(false);
    setMsg(r.ok ? t("trial_started", { date: fmt(o.trial_end) }) : o.error);
    if (r.ok) load();
  }
  async function subscribe() {
    setBusy(true); setMsg("");
    const r = await authFetch("/api/subscribe", { method: "POST", body: JSON.stringify({ plan: planCode }) }); const o = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(o.error);
    const email = (await sbc.auth.getSession()).data.session?.user.email;
    checkoutSub(o, email, ok => { setMsg(ok ? t("premium_thanks") : t("payment_unverified")); load(); });
  }
  async function cancel() {
    if (!confirm(t("cancel_confirm"))) return;
    setBusy(true); setMsg("");
    const r = await authFetch("/api/subscribe/cancel", { method: "POST", body: "{}" }); const o = await r.json();
    setBusy(false);
    setMsg(r.ok ? t("cancelled_until", { date: fmt(o.current_period_end) }) : o.error);
    if (r.ok) load();
  }

  return (
    <main>
      <div className="pagehead"><h1>⭐ Premium</h1>
        <p>{t("up_sub")}</p></div>

      {st?.loggedIn && premium && (
        <article className="card" style={{ borderColor: "var(--gold)" }}>
          <span className="planbadge">{st.status === "trialing" ? t("free_trial_badge") : t("premium_active")}</span>
          <div style={{ marginTop: 8 }}>
            {st.status === "trialing"
              ? <>{t("trial_until", { date: fmt(st.trial_end) })}</>
              : <>{t("premium_until", { date: fmt(st.current_period_end) })}</>}
          </div>
          {st.cancel_at_period_end
            ? <p className="note">{t("renewal_off")}</p>
            : <p style={{ marginTop: 10 }}><button className="upbtn ghost" disabled={busy} onClick={cancel}>{t("cancel_sub")}</button></p>}
        </article>
      )}

      {st?.loggedIn && !premium && !st.trial_claimed && (
        <article className="card" style={{ borderColor: "var(--gold)" }}>
          <b>🎁 {t("trial_card_title")}</b>
          <p className="note" style={{ marginTop: 6 }}>{t("trial_card_text")}</p>
          <p style={{ marginTop: 10 }}><button className="upbtn" disabled={busy} onClick={startTrial}>{t("start_trial")}</button></p>
        </article>
      )}

      <div className="plantoggle" role="tablist" aria-label="Billing">
        <button className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>{t("monthly_word")}</button>
        <button className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>{t("yearly_free")}</button>
      </div>

      <div className="chips">
        <article className="card">
          <div className="ref">{t("free_word")}</div>
          <div className="price">₹0</div>
          <div className="note">{t("free_desc")}</div>
        </article>
        <article className="card" style={{ borderColor: "var(--gold)" }}>
          <div className="ref">Premium</div>
          {cycle === "monthly"
            ? <div className="price">₹149<small>{t("per_month")}</small></div>
            : <div className="price">₹999<small>{t("per_year")}</small></div>}
          <div className="note">{cycle === "yearly" ? t("two_months_free") + " " : ""}{t("up_renew")}</div>
          <p style={{ marginTop: 12 }}>
            {!st ? <span className="note">{t("loading_word")}</span>
              : !st.loggedIn ? <a className="upbtn" href="/login">{t("login_first")}</a>
              : premium && st.status !== "trialing" ? <span className="planbadge">{t("current_plan")}</span>
              : <button className="upbtn" disabled={busy} onClick={subscribe}>{st.status === "trialing" ? t("continue_premium") : t("get_premium")}</button>}
          </p>
        </article>
      </div>

      <article className="card">
        <b>{t("compare_title")}</b>
        <table className="cmp"><tbody>
          <tr><th></th><th>{t("free_word")}</th><th>Premium</th></tr>
          {FEATURES.map(([f, a, b, goodA]) => (
            <tr key={f}><td>{f}</td><td className={goodA ? "" : "no"}>{a}</td><td>{b}</td></tr>))}
        </tbody></table>
        <p className="note">{t("payments_note")} <a href="/refund">{t("refund_policy")}</a></p>
      </article>

      {msg && <p className="note">{msg}</p>}
      <p className="note"><a href="/">{t("back_chat")}</a></p>
    </main>
  );
}
