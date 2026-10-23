"use client";
import { useEffect, useState } from "react";
import { useUiLang } from "@/lib/i18n";

const DHIKR = [
  { ar: "سُبْحَانَ الله", t: "SubhanAllah" },
  { ar: "الْحَمْدُ لِلَّه", t: "Alhamdulillah" },
  { ar: "اللهُ أَكْبَر", t: "Allahu Akbar" },
  { ar: "لَا إِلٰهَ إِلَّا الله", t: "La ilaha illallah" },
  { ar: "أَسْتَغْفِرُ الله", t: "Astaghfirullah" },
];
const TARGETS = [33, 100, 1000];
const R = 100, CIRC = 2 * Math.PI * R;

type Saved = { di: number; counts: Record<number, number>; target: number };

function loadSaved(): Saved {
  try {
    const j = JSON.parse(localStorage.getItem("tasbih") || "{}");
    return { di: j.di ?? 0, counts: j.counts ?? {}, target: j.target ?? 33 };
  } catch { return { di: 0, counts: {}, target: 33 }; }
}

export default function Tasbih() {
  const { t } = useUiLang();
  const [di, setDi] = useState(0);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [target, setTarget] = useState(33);
  const [custom, setCustom] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => { const s = loadSaved(); setDi(s.di); setCounts(s.counts); setTarget(s.target); setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem("tasbih", JSON.stringify({ di, counts, target })); }, [di, counts, target, ready]);

  const count = counts[di] ?? 0;
  const prog = target > 0 ? Math.min(count / target, 1) : 0;

  function tap() {
    const n = count + 1;
    setCounts(c => ({ ...c, [di]: n }));
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (n === target) navigator.vibrate([60, 40, 60]);
      else if (n % 100 === 0 || n % 33 === 0) navigator.vibrate(40);
    }
  }
  function reset() { if (confirm(t("reset_confirm"))) setCounts(c => ({ ...c, [di]: 0 })); }
  function pickTarget(t: number) { setTarget(t); setCustom(""); }
  function applyCustom() { const n = parseInt(custom, 10); if (n > 0 && n <= 100000) setTarget(n); }

  return (
    <main>
      <div className="pagehead"><h1>{t("nav_tasbih")}</h1><p>{t("tasbih_sub")}</p></div>
      <div className="tasbih-wrap">
        <div className="chips" style={{ marginBottom: 6 }}>
          {DHIKR.map((d, i) => (
            <button key={d.t} className="chip" onClick={() => setDi(i)}
              style={i === di ? { borderColor: "var(--gold)" } : undefined}>
              <span className="dhikr-name" style={{ fontSize: "1.5rem", margin: 0 }}>{d.ar}</span><small>{d.t}</small>
            </button>))}
        </div>
        <div className="dhikr-name" lang="ar">{DHIKR[di].ar}</div>
        <p className="dhikr-t">{DHIKR[di].t}</p>

        <button className="tapzone" onClick={tap} aria-label={t("tap_to_count")}>
          <svg className="ring" viewBox="0 0 232 232">
            <circle className="rbg" cx="116" cy="116" r={R} />
            <circle className="rfg" cx="116" cy="116" r={R}
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - prog)} />
          </svg>
          <span className="cnt">{count}</span>
          <span className="of">/ {target}</span>
          <span className="tap-hint">{t("tap_word")}</span>
        </button>

        <div className="tgt-row">
          {TARGETS.map(t => (
            <button key={t} className={"tgt" + (target === t && !custom ? " on" : "")} onClick={() => pickTarget(t)}>{t}</button>))}
          <input className="tgt-custom" value={custom} inputMode="numeric" placeholder={t("custom_word")}
            onChange={e => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))} onBlur={applyCustom}
            aria-label={t("custom_target")} />
        </div>
        <div className="tasbih-tools">
          <button onClick={reset}>{t("reset_word")}</button>
          <button onClick={() => setCounts(c => ({ ...c, [di]: Math.max(0, count - 1) }))}>− 1</button>
        </div>
      </div>
    </main>
  );
}
