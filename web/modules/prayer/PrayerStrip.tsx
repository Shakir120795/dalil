"use client";
import { useEffect, useState } from "react";
import { scheduleAzaan } from "@/lib/azaan";
import { usePrayerTimes, PRAYER_NAMES } from "./usePrayerTimes";
import QiblaCompass from "./QiblaCompass";
import { useUiLang } from "@/lib/i18n";

const toDate = (hm: string, base: Date, addDay = 0) => {
  const [h, m] = hm.slice(0, 5).split(":").map(Number);
  const d = new Date(base); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + addDay); return d;
};

export default function PrayerStrip() {
  const { times, hijri, ramadan, pos, err, now, reload } = usePrayerTimes();
  const { t } = useUiLang();
  const [azaan, setAzaan] = useState(false); const [qibla, setQibla] = useState(false);

  useEffect(() => { setAzaan(localStorage.getItem("azaan") === "1"); }, []);
  useEffect(() => { if (times) scheduleAzaan(times, azaan); }, [times, azaan]);

  if (!times) return <div className="prayer"><span>{err || t("loading_prayer")}</span>{err && <button onClick={reload}>{t("allow_location")}</button>}</div>;

  const list = PRAYER_NAMES.map(n => ({ n, at: toDate(times[n], now) }));
  const next = list.find(x => x.at > now) ?? { n: "Fajr" as const, at: toDate(times.Fajr, now, 1) };
  const s = Math.max(0, Math.floor((+next.at - +now) / 1000));
  const cd = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, "0")).join(":");

  return (
    <div className="prayer">
      <div className="next"><span>{t("next_prayer", { name: next.n })}</span><b>{cd}</b></div>
      <div className="times">{list.map(x => <div key={x.n} className={x.n === next.n ? "on" : ""}><small>{x.n}</small>{times[x.n].slice(0, 5)}</div>)}</div>
      {ramadan && <div className="ramadan">{t("ramadan_line", { fajr: times.Fajr.slice(0, 5), maghrib: times.Maghrib.slice(0, 5) })}</div>}
      <small className="hijri">{hijri}</small>
      <div className="tools">
        <label><input type="checkbox" style={{ flex: "none" }} checked={azaan}
          onChange={e => { setAzaan(e.target.checked); localStorage.setItem("azaan", e.target.checked ? "1" : "0"); }} /> {t("azaan_reminder")}</label>
        <button onClick={() => setQibla(v => !v)}>{qibla ? t("hide_qibla") : t("show_qibla")}</button>
      </div>
      {qibla && pos && <QiblaCompass lat={pos.lat} lng={pos.lng} />}
    </div>
  );
}
