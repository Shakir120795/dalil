"use client";
import { useEffect, useState } from "react";
import { scheduleAzaan } from "@/lib/azaan";
import { getPrefs, methodName } from "@/lib/region";
import { usePrayerTimes } from "@/modules/prayer/usePrayerTimes";
import QiblaCompass from "@/modules/prayer/QiblaCompass";
import { useUiLang } from "@/lib/i18n";

const ORDER = [
  ["Fajr", "🌅"], ["Sunrise", "☀️"], ["Dhuhr", "🌞"], ["Asr", "🌤️"], ["Maghrib", "🌇"], ["Isha", "🌙"],
] as const;
// Prayer names stay transliterations; Arabic names sit alongside (as in the strip).
const AR_NAME: Record<string, string> = { Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
const toDate = (hm: string, base: Date, addDay = 0) => {
  const [h, m] = hm.slice(0, 5).split(":").map(Number);
  const d = new Date(base); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + addDay); return d;
};

export default function Namaz() {
  const { times, hijri, ramadan, pos, err, now, reload } = usePrayerTimes();
  const { lang: uiLang, t } = useUiLang();
  const [azaan, setAzaan] = useState(false); const [qibla, setQibla] = useState(false);
  const [calcNote, setCalcNote] = useState("");

  useEffect(() => { setAzaan(localStorage.getItem("azaan") === "1"); }, []);
  useEffect(() => {
    try { const p = getPrefs();
      setCalcNote(t("calc_note", { method: methodName(p.prayerMethod), school: p.prayerSchool === 1 ? "Hanafi" : "Shafi’i" }));
    } catch { /* keep empty note */ }
  }, [uiLang, t]);
  useEffect(() => { if (times) scheduleAzaan(times, azaan); }, [times, azaan]);

  if (!times) return (<main>
    <div className="pagehead"><h1>{t("namaz_title")}</h1></div>
    <p className="note">{err || t("loading_prayer")}</p>
    {err && <button onClick={reload}>{t("try_again")}</button>}
  </main>);

  const list = ORDER.filter(([n]) => times[n]).map(([n, ic]) => ({ n, ic, at: toDate(times[n], now) }));
  const prayers = list.filter(x => x.n !== "Sunrise");
  const next = prayers.find(x => x.at > now) ?? { n: "Fajr", ic: "🌅", at: toDate(times.Fajr, now, 1) };
  const s = Math.max(0, Math.floor((+next.at - +now) / 1000));
  const cd = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, "0")).join(":");

  return (
    <main>
      <div className="pagehead"><h1>{t("namaz_title")}</h1><p>{hijri}</p></div>
      <div className="nextcd"><span>{t("next_prayer_short").toUpperCase()} · {next.n}</span><b>{cd}</b></div>
      <div className="ttable">
        {list.map(x => (
          <div key={x.n} className={"tt-row" + (x.n === next.n ? " tt-next" : "")}>
            <span className="tn"><i>{x.ic}</i>{x.n} <span lang="ar" style={{ color: "var(--gold-soft)", fontFamily: "var(--font-ar)" }}>{AR_NAME[x.n]}</span></span>
            <span className="tt">{times[x.n].slice(0, 5)}</span>
          </div>))}
      </div>
      {ramadan && <div className="card"><div className="ref">{t("ramadan_word")}</div>
        <div>{t("sehri_iftar", { fajr: times.Fajr.slice(0, 5), maghrib: times.Maghrib.slice(0, 5) })}</div></div>}
      <div className="card">
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" style={{ flex: "none" }} checked={azaan}
            onChange={e => { setAzaan(e.target.checked); localStorage.setItem("azaan", e.target.checked ? "1" : "0"); }} />
          <span>{t("azaan_reminder")} <small className="note" style={{ display: "block", margin: 0 }}>{t("azaan_reminder_desc")}</small></span>
        </label>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setQibla(v => !v)}>{qibla ? t("hide_qibla") : t("show_qibla_compass")}</button>
        </div>
        {qibla && pos && <QiblaCompass lat={pos.lat} lng={pos.lng} />}
      </div>
      <p className="note">{calcNote}</p>
    </main>
  );
}
