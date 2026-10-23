"use client";
import { useEffect, useRef, useState } from "react";
import { authFetch, sbc } from "@/lib/client";
import { REPLY_LANGS } from "@/lib/lang";
import { METHOD_OPTIONS, REGION_ROWS, regionByCode, answerLangOptionsForRegion, getPrefs, savePrefs, type Prefs } from "@/lib/region";
import { subscribePush, unsubscribe as pushOff, updatePrefs, isPushOn, isNativeApp, isPushSupported, getPermissionState, currentDevicePrefs, type PushPrefs } from "@/lib/push";
import { useUiLang, type TFunc } from "@/lib/i18n";

type ProfileData = {
  email: string | null; display_name: string | null; answer_lang: string | null;
  translation_lang: string | null; region: string | null;
  prayer_method: number | null; prayer_school: number | null;
  plan: { code: string; status: string; current_period_end: string | null; trial_end: string | null };
  counts: { questions: number; expert_questions: number; bookings: number; dua_requests: number };
};

function planName(code: string, t: TFunc): string {
  switch (code) {
    case "free": return t("free_word");
    case "premium_monthly": return t("plan_premium_monthly");
    case "premium_yearly": return t("plan_premium_yearly");
    case "trial": return t("free_trial_badge");
    default: return "Premium";
  }
}

function planLine(d: ProfileData | null, t: TFunc, fmt: (iso: string | null) => string): { title: string; sub: string } {
  if (!d || d.plan.code === "free") return { title: t("plan_free_title"), sub: t("plan_free_sub") };
  const name = planName(d.plan.code, t);
  if (d.plan.status === "trialing") {
    const days = d.plan.trial_end ? Math.max(0, Math.ceil((+new Date(d.plan.trial_end) - Date.now()) / 86400000)) : 0;
    return { title: t("free_trial_badge"), sub: t("plan_trial_sub", { days, date: fmt(d.plan.trial_end) }) };
  }
  if (d.plan.status === "past_due") return { title: name, sub: t("plan_pastdue_sub") };
  if (d.plan.status === "cancelled") return { title: name, sub: t("plan_cancelled_sub", { date: fmt(d.plan.current_period_end) }) };
  return { title: name, sub: t("plan_active_sub", { date: fmt(d.plan.current_period_end) }) };
}

export default function Profile() {
  const { lang: uiLang, t } = useUiLang();
  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString(REPLY_LANGS[uiLang]?.locale ?? "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const [phase, setPhase] = useState<"loading" | "out" | "in">("loading");
  const [data, setData] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pushState, setPushState] = useState<"loading" | "notsetup" | "off" | "on" | "denied">("loading");
  const [pushPrefs, setPushPrefs] = useState<PushPrefs>({ pref_expert: true, pref_dua: true, pref_daily: true });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  function flash() {
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 1600);
  }

  useEffect(() => {
    let p = getPrefs();
    if (p.azaan === undefined) { p = { ...p, azaan: localStorage.getItem("azaan") === "1" }; }
    setPrefs(p);
    (async () => {
      const { data: sess } = await sbc.auth.getSession();
      if (!sess.session) { setPhase("out"); return; }
      setPhase("in");
      try {
        const r = await authFetch("/api/profile");
        if (!r.ok) return;                       // fail soft: local prefs are already shown
        const d = await r.json() as ProfileData;
        setData(d); setName(d.display_name ?? "");
        const merged: Partial<Prefs> = {};
        if (d.answer_lang) merged.answerLang = d.answer_lang;
        if (d.translation_lang) merged.translationLang = d.translation_lang;
        if (d.region) merged.region = d.region;
        if (typeof d.prayer_method === "number") merged.prayerMethod = d.prayer_method;
        if (typeof d.prayer_school === "number") merged.prayerSchool = d.prayer_school;
        if (Object.keys(merged).length) setPrefs(savePrefs(merged));
      } catch { /* fail soft */ }
    })();
  }, []);

  // Save locally at once; mirror to the account when signed in.
  async function save(partial: Partial<Prefs>, api: Record<string, unknown>) {
    setPrefs(savePrefs(partial));
    if (phase === "in") {
      try { await authFetch("/api/profile", { method: "PUT", body: JSON.stringify(api) }); } catch { /* local copy saved */ }
    }
    flash();
  }

  async function saveName() {
    const v = name.trim();
    setData(d => d ? { ...d, display_name: v || null } : d);
    if (phase === "in") {
      try { await authFetch("/api/profile", { method: "PUT", body: JSON.stringify({ display_name: v }) }); } catch { /* ignore */ }
    }
    flash();
  }

  async function signOut() { await sbc.auth.signOut(); location.href = "/"; }

  // Push ki haalat: server par VAPID key hai ya nahi, permission, aur is device ki saved prefs.
  useEffect(() => {
    (async () => {
      try {
        const native = await isNativeApp();
        if (!native) {
          if (!isPushSupported()) { setPushState("notsetup"); return; }
          const r = await fetch("/api/push/key");
          const j = await r.json();
          if (!j.publicKey) { setPushState("notsetup"); return; }
        }
        if ((await getPermissionState()) === "denied") { setPushState("denied"); return; }
        const on = await isPushOn();
        if (on) { const p = await currentDevicePrefs(); if (p) setPushPrefs(p); }
        setPushState(on ? "on" : "off");
      } catch { setPushState("notsetup"); }
    })();
  }, []);

  async function enablePush() {
    setPushBusy(true); setPushMsg("");
    const r = await subscribePush(pushPrefs);
    setPushBusy(false);
    if (r.ok) { setPushState("on"); flash(); }
    else {
      setPushMsg(r.message);
      if ((await getPermissionState()) === "denied") setPushState("denied");
    }
  }
  async function disablePush() {
    setPushBusy(true); setPushMsg("");
    const r = await pushOff();
    setPushBusy(false);
    if (r.ok) { setPushState("off"); flash(); } else setPushMsg(r.message);
  }
  async function togglePushPref(key: keyof PushPrefs, val: boolean) {
    setPushPrefs(p => ({ ...p, [key]: val }));
    const r = await updatePrefs({ [key]: val });
    if (r.ok) flash(); else setPushMsg(r.message);
  }

  if (phase === "loading") return (
    <main>
      <div className="pagehead"><h1>{t("profile_title")}</h1><p>{t("profile_sub")}</p></div>
      <p className="note">{t("loading_profile")}</p>
    </main>);

  if (phase === "out") return (
    <main>
      <div className="pagehead"><h1>{t("profile_title")}</h1><p>{t("profile_sub")}</p></div>
      <div className="card">
        <p style={{ margin: "4px 0 12px" }}>{t("signin_view")}</p>
        <a className="upbtn" href="/login">{t("sign_in")}</a>
      </div>
    </main>);

  const src = (name || data?.display_name || data?.email || "").trim();
  const initials = src ? src.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() : "👤";
  const pl = planLine(data, t, fmt);
  const c = data?.counts;
  const tile = (n: number | undefined, label: string) => (
    <div className="pf-stat"><b>{n === undefined ? "—" : n}</b><small>{label}</small></div>);
  const autoName = prefs ? (REPLY_LANGS[prefs.detected.answerLang]?.name ?? "English") : "English";
  // Region-aware answer-language options. If the saved language is not in the
  // current region's list, it is still shown in the region group (marked as the
  // current selection) so a saved choice is never silently lost.
  const regionLangOpts = prefs ? answerLangOptionsForRegion(prefs.region) : [];
  const extraLangOpt = prefs && prefs.answerLang !== "auto"
    && !regionLangOpts.some(o => o.code === prefs.answerLang) && REPLY_LANGS[prefs.answerLang]
    ? [{ code: prefs.answerLang, name: `${REPLY_LANGS[prefs.answerLang].name} (current)` }] : [];

  return (
    <main>
      <div className="pagehead"><h1>{t("profile_title")}</h1>
        <p>{t("profile_sub")}{saved && <span className="savedtag">{t("saved_word")}</span>}</p></div>

      {/* Account */}
      <div className="card"><div className="pf-head">
        <span className="avatar">{initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pf-name">
            <input type="text" value={name} maxLength={60} onChange={e => setName(e.target.value)}
              placeholder={t("display_name_ph")} aria-label={t("display_name_ph")} />
            <button onClick={saveName}>{t("save_word")}</button>
          </div>
          <div className="note" style={{ marginTop: 6 }}>{data?.email ?? ""}</div>
        </div>
      </div></div>

      {/* Plan */}
      <div className="card">
        <div className="ref">{t("your_plan")}</div>
        <p style={{ margin: "6px 0 12px" }}><b>{pl.title}</b>
          <span className="note" style={{ display: "block", marginTop: 2 }}>{pl.sub}</span></p>
        <a className="upbtn" href="/upgrade">{data && data.plan.code !== "free" ? t("manage_plan") : t("upgrade_word")}</a>
      </div>

      {/* Preferences */}
      {prefs && (
        <div className="card">
          <div className="ref">{t("preferences_word")}</div>
          <label className="pf-field"><span>{t("answer_language")}</span>
            <select value={prefs.answerLang} onChange={e => save({ answerLang: e.target.value }, { answer_lang: e.target.value })}>
              <option value="auto">{t("auto_detected", { name: autoName })}</option>
              <optgroup label={`Languages in ${regionByCode(prefs.region).label}`}>
                {regionLangOpts.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                {extraLangOpt.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
              </optgroup>
            </select></label>
          <label className="pf-field"><span>{t("source_translations")}</span>
            <select value={prefs.translationLang} onChange={e => { localStorage.setItem("lang", e.target.value); save({ translationLang: e.target.value }, { translation_lang: e.target.value }); }}>
              <option value="en">English</option><option value="hi">English + Hindi</option><option value="ur">English + Urdu</option>
            </select></label>
          <label className="pf-field"><span>{t("region_word")}</span>
            <select value={prefs.region} onChange={e => { const row = regionByCode(e.target.value);
              save({ region: row.code, prayerMethod: row.prayerMethod, prayerSchool: row.prayerSchool },
                { region: row.code, prayer_method: row.prayerMethod, prayer_school: row.prayerSchool }); }}>
              {REGION_ROWS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select></label>
          <p className="note" style={{ marginTop: 0 }}>{t("region_note", { region: regionByCode(prefs.region).label })}</p>
          <label className="pf-field"><span>{t("prayer_method")}</span>
            <select value={prefs.prayerMethod} onChange={e => save({ prayerMethod: Number(e.target.value) }, { prayer_method: Number(e.target.value) })}>
              {METHOD_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          <label className="pf-field"><span>{t("asr_calc")}</span>
            <select value={prefs.prayerSchool} onChange={e => save({ prayerSchool: Number(e.target.value) }, { prayer_school: Number(e.target.value) })}>
              <option value={0}>Shafi’i</option><option value={1}>Hanafi</option>
            </select></label>
        </div>
      )}

      {/* Activity */}
      <div className="card">
        <div className="ref">{t("my_activity")}</div>
        <div className="pf-stats">
          {tile(c?.questions, t("stat_questions"))}
          {tile(c?.expert_questions, t("stat_expert_q"))}
          {tile(c?.bookings, t("stat_bookings"))}
          {tile(c?.dua_requests, t("stat_dua"))}
        </div>
        <p className="note"><a href="/experts">{t("my_expert_q_link")}</a> · <a href="/dua">{t("my_dua_link")}</a></p>
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="ref">{t("notifications_word")}</div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
          <input type="checkbox" style={{ flex: "none" }} checked={!!prefs?.azaan}
            onChange={e => { localStorage.setItem("azaan", e.target.checked ? "1" : "0");
              setPrefs(savePrefs({ azaan: e.target.checked })); flash(); }} />
          <span>{t("azaan_reminder")}<small className="note" style={{ display: "block", margin: 0 }}>{t("azaan_reminder_desc")}</small></span>
        </label>

        <div style={{ borderTop: "1px solid var(--line, #e5e0d5)", marginTop: 14, paddingTop: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ flex: 1 }}>{t("push_notifications")}<small className="note" style={{ display: "block", margin: 0 }}>{t("push_desc")}</small></span>
            {pushState === "on"
              ? <button className="upbtn ghost" disabled={pushBusy} onClick={disablePush}>{t("turn_off")}</button>
              : pushState === "off"
                ? <button className="upbtn" disabled={pushBusy} onClick={enablePush}>{pushBusy ? t("turning_on") : t("enable_push")}</button>
                : null}
          </label>
          {pushState === "loading" && <p className="note" style={{ marginBottom: 0 }}>{t("checking_push")}</p>}
          {pushState === "notsetup" && <p className="note" style={{ marginBottom: 0 }}>{t("push_not_setup")}</p>}
          {pushState === "denied" && <p className="note" style={{ marginBottom: 0 }}>{t("push_denied")}</p>}
          {pushState === "on" && (
            <div style={{ marginTop: 6 }}>
              {([["pref_expert", "push_expert", "push_expert_sub"],
                 ["pref_dua", "push_dua", "push_dua_sub"],
                 ["pref_daily", "push_daily", "push_daily_sub"]] as [keyof PushPrefs, "push_expert" | "push_dua" | "push_daily", "push_expert_sub" | "push_dua_sub" | "push_daily_sub"][]).map(([key, labelKey, subKey]) => (
                <label key={key} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                  <input type="checkbox" style={{ flex: "none" }} checked={pushPrefs[key]}
                    onChange={e => togglePushPref(key, e.target.checked)} />
                  <span>{t(labelKey)}<small className="note" style={{ display: "block", margin: 0 }}>{t(subKey)}</small></span>
                </label>
              ))}
            </div>
          )}
          {pushMsg && <p className="note" style={{ marginBottom: 0 }}>{pushMsg}</p>}
        </div>
      </div>

      <p><button className="upbtn ghost" onClick={signOut}>{t("sign_out")}</button></p>
    </main>
  );
}
