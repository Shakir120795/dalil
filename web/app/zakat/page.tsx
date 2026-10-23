"use client";
import { useEffect, useMemo, useState } from "react";

/*
 * Zakat calculator — Dalil v2 drop-in page (web/app/zakat/page.tsx)
 *
 * Fiqh logic (verified 2026-10-17, sources in README):
 * - Nisab: 85g gold OR 595g silver (AAOIFI/AMJA standard). Hanafi classical
 *   weights (87.48g / 612.36g) differ slightly; we use 85/595 and note it.
 * - Rate: 2.5% (1/40) of NET zakatable wealth held for one lunar year (hawl).
 * - Zakatable: cash, bank balances, gold, silver, stocks/investments,
 *   business inventory, receivables expected back. Deduct debts.
 * - Exempt: primary home, personal vehicle, household items, personal use items.
 * - Most scholars recommend the SILVER nisab for cash/mixed portfolios
 *   (lower threshold => more people qualify => more beneficiaries) — default.
 * - Worn jewelry: schools differ (Hanafi counts it, others exempt regularly-worn).
 *   We flag this in the disclaimer instead of deciding for the user.
 * - This is a calculation guide, not a fatwa. Consult a scholar for edge cases.
 *
 * Prices: live per-gram INR from OroPocket public API (no key, free),
 * cached 12h in localStorage; manual override always available.
 * Valuation uses the SELL rate (what the holder would actually receive).
 */

const API = "https://api.oropocket.com/public/prices";
const CACHE_KEY = "dalil-metal-prices";
const CACHE_MS = 12 * 60 * 60 * 1000;

type Prices = { gold: number; silver: number; asOf: string; live: boolean };

const FALLBACK: Prices = { gold: 14640.42, silver: 206.91, asOf: "", live: false };

const KARATS = [
  { k: "24K", f: 1 },
  { k: "22K", f: 22 / 24 },
  { k: "18K", f: 18 / 24 },
];

function num(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return isFinite(n) && n > 0 ? n : 0;
}
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function loadCache(): Prices | null {
  try {
    const j = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (j && Date.now() - new Date(j.asOf).getTime() < CACHE_MS) return j;
  } catch { /* ignore */ }
  return null;
}

function Field({ label, sub, value, onChange, ph }: { label: string; sub?: string; value: string; onChange: (v: string) => void; ph?: string }) {
  return (
    <label className="zk-f">
      <span className="zk-l">{label}{sub ? <small> — {sub}</small> : null}</span>
      <span className="zk-in"><span className="zk-cur">₹</span>
        <input inputMode="decimal" placeholder={ph || "0"} value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9.,]/g, ""))} aria-label={label} />
      </span>
    </label>
  );
}

export default function Zakat() {
  // assets
  const [cash, setCash] = useState("");
  const [goldG, setGoldG] = useState("");
  const [karat, setKarat] = useState(1);
  const [silverG, setSilverG] = useState("");
  const [stocks, setStocks] = useState("");
  const [inventory, setInventory] = useState("");
  const [receivables, setReceivables] = useState("");
  // liabilities
  const [debts, setDebts] = useState("");
  // nisab
  const [std, setStd] = useState<"silver" | "gold">("silver");
  const [hawl, setHawl] = useState(false);
  const [prices, setPrices] = useState<Prices>(FALLBACK);
  const [goldP, setGoldP] = useState("");
  const [silverP, setSilverP] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const cached = loadCache();
    if (cached) { setPrices(cached); return; }
    (async () => {
      try {
        const r = await fetch(API, { signal: AbortSignal.timeout(10000) });
        const j = await r.json();
        const p: Prices = {
          gold: Number(j?.data?.gold?.sell) || FALLBACK.gold,
          silver: Number(j?.data?.silver?.sell) || FALLBACK.silver,
          asOf: j?.data?.timestamp || new Date().toISOString(),
          live: true,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(p));
        if (alive) setPrices(p);
      } catch { /* fallback prices stay */ }
    })();
    return () => { alive = false; };
  }, []);

  const gp = goldP !== "" ? num(goldP) : prices.gold;
  const sp = silverP !== "" ? num(silverP) : prices.silver;

  const calc = useMemo(() => {
    const goldVal = num(goldG) * karat * (gp || 0);
    const silverVal = num(silverG) * (sp || 0);
    const gross =
      num(cash) + goldVal + silverVal + num(stocks) + num(inventory) + num(receivables);
    const net = gross - num(debts);
    const nisab = std === "silver" ? 595 * (sp || 0) : 85 * (gp || 0);
    const aboveNisab = net >= nisab && nisab > 0;
    const due = hawl && aboveNisab ? net * 0.025 : 0;
    return { goldVal, silverVal, gross, net, nisab, aboveNisab, due };
  }, [cash, goldG, karat, silverG, stocks, inventory, receivables, debts, std, hawl, gp, sp]);

  const asOf = prices.asOf
    ? new Date(prices.asOf).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  async function copyResult() {
    const lines = [
      "Dalil — Zakat calculation",
      `Net zakatable wealth: ${inr(calc.net)}`,
      `Nisab (${std === "silver" ? "595g silver" : "85g gold"}): ${inr(calc.nisab)}`,
      calc.due > 0 ? `Zakat due (2.5%): ${inr(calc.due)}` : "Zakat is not due yet.",
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard unavailable */ }
  }

  const F = Field;

  return (
    <main>
      <div className="pagehead">
        <h1>Zakat calculator</h1>
        <p>Enter your wealth — the nisab, hawl and 2.5% are worked out for you.</p>
      </div>

      {/* Nisab standard */}
      <div className="card">
        <b>Nisab standard</b>
        <div className="chips" style={{ marginTop: 8 }}>
          <button className="chip" onClick={() => setStd("silver")}
            style={std === "silver" ? { borderColor: "var(--gold)" } : undefined}>
            <b>🥈 Silver — 595g</b><small>Recommended by most scholars — more people qualify to pay</small>
          </button>
          <button className="chip" onClick={() => setStd("gold")}
            style={std === "gold" ? { borderColor: "var(--gold)" } : undefined}>
            <b>🥇 Gold — 85g</b><small>Higher threshold — due from fewer people</small>
          </button>
        </div>
        <div className="zk-prices">
          <div>
            <span>Gold <b>{inr(gp)}/g</b></span>
            <input inputMode="decimal" placeholder="manual" value={goldP} aria-label="Gold price per gram"
              onChange={e => setGoldP(e.target.value.replace(/[^0-9.,]/g, ""))} />
          </div>
          <div>
            <span>Silver <b>{inr(sp)}/g</b></span>
            <input inputMode="decimal" placeholder="manual" value={silverP} aria-label="Silver price per gram"
              onChange={e => setSilverP(e.target.value.replace(/[^0-9.,]/g, ""))} />
          </div>
        </div>
        <small className="zk-note">
          {prices.live ? "Live" : "Estimated"} rate{asOf ? ` — ${asOf}` : ""} (OroPocket public API, 12h cache).
          To use your own rate, type it into the box.
        </small>
      </div>

      {/* Assets */}
      <div className="card">
        <b>💰 What you own</b>
        <F label="Cash and bank savings" sub="cash at home + bank accounts" value={cash} onChange={setCash} />
        <div className="zk-f">
          <span className="zk-l">Gold <small>— weight (grams) + karat</small></span>
          <span className="zk-in">
            <input inputMode="decimal" placeholder="gram" value={goldG} aria-label="Gold grams"
              onChange={e => setGoldG(e.target.value.replace(/[^0-9.,]/g, ""))} style={{ width: "100%" }} />
            <select value={String(karat)} onChange={e => setKarat(Number(e.target.value))} aria-label="Karat">
              {KARATS.map(k => <option key={k.k} value={String(k.f)}>{k.k}</option>)}
            </select>
          </span>
        </div>
        <div className="zk-f">
          <span className="zk-l">Silver <small>— weight (grams)</small></span>
          <span className="zk-in"><span className="zk-cur">g</span>
            <input inputMode="decimal" placeholder="gram" value={silverG} aria-label="Silver grams"
              onChange={e => setSilverG(e.target.value.replace(/[^0-9.,]/g, ""))} />
          </span>
        </div>
        <F label="Stocks / investments" sub="market value" value={stocks} onChange={setStocks} />
        <F label="Business inventory" sub="shop/business inventory" value={inventory} onChange={setInventory} />
        <F label="Money you have lent" sub="that you expect to receive back" value={receivables} onChange={setReceivables} />
      </div>

      {/* Liabilities */}
      <div className="card">
        <b>🧾 What you owe</b>
        <F label="Debts and dues" sub="amounts you must repay — these are deducted" value={debts} onChange={setDebts} />
      </div>

      {/* Hawl */}
      <label className="card zk-hawl">
        <input type="checkbox" checked={hawl} onChange={e => setHawl(e.target.checked)} />
        <span><b>Hawl completed</b><br />
          <small>I have owned this wealth, at or above the nisab, for one full lunar year.</small></span>
      </label>

      {/* Result */}
      <div className={"card zk-res" + (calc.due > 0 ? " due" : "")}>
        <div className="zk-resrow"><span>Net zakatable wealth</span><b>{inr(calc.net)}</b></div>
        <div className="zk-resrow"><span>Nisab ({std === "silver" ? "595g silver" : "85g gold"})</span><b>{inr(calc.nisab)}</b></div>
        <div className="zk-resrow big">
          <span>Zakat due (2.5%)</span><b>{calc.due > 0 ? inr(calc.due) : "—"}</b>
        </div>
        <p className="zk-status">
          {!calc.aboveNisab && "⚠️ Your wealth is below the nisab — zakat is not due."}
          {calc.aboveNisab && !hawl && "ℹ️ You are above the nisab, but zakat becomes due only once the hawl (one lunar year) is complete."}
          {calc.due > 0 && "✅ Zakat is due — please give the amount above to those who are eligible to receive it."}
        </p>
        <button className="chip" onClick={copyResult} style={{ width: "100%", justifyContent: "center" }}>
          {copied ? "✅ Copied" : "📋 Copy result"}
        </button>
      </div>

      <div className="card">
        <b>📜 Please note</b>
        <ul className="zk-list">
          <li>There is no zakat on your home, vehicle, or everyday household items.</li>
          <li>Scholars differ on jewellery that is worn regularly (Hanafi fiqh counts it; some others exempt it) — please ask a scholar of your school of thought.</li>
          <li>Zakat al-Fitr (paid before Eid, for every person) is separate from this.</li>
          <li>This calculation is a guide, not a fatwa. For difficult cases, ask the Dalil chatbot or an expert.</li>
        </ul>
      </div>
    </main>
  );
}
