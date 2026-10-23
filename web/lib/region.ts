"use client";
// Region auto-detection + user preferences (client-safe only — no server imports).
// Detection: timezone is primary; the browser language can override the answer
// language when it clearly maps to one of the supported reply languages.
// Prefs live in localStorage under 'dalil_prefs' and (when logged in) mirror to
// the profiles table via /api/profile.
import { REPLY_LANGS } from "./lang";

export type RegionRow = {
  code: string; label: string; answerLang: string; translationLang: string;
  prayerMethod: number; prayerSchool: number; voiceLocale: string;
  // Answer languages offered for this region (replyLang codes). English is
  // always present so any user can pick English or a local language.
  languages: string[];
};

const ROW = (code: string, label: string, answerLang: string, translationLang: string,
  prayerMethod: number, prayerSchool: number, voiceLocale: string, languages: string[]): RegionRow =>
  ({ code, label, answerLang, translationLang, prayerMethod, prayerSchool, voiceLocale, languages });

// Simplified rule: each region offers only its main language + English.
// India is the one exception (Hindi, Hinglish, English, Urdu); US/UK English only.
export const REGION_ROWS: RegionRow[] = [
  ROW("IN", "India", "en", "en", 1, 1, "en-IN",
    ["hi", "hinglish", "en", "ur"]),
  ROW("PK", "Pakistan", "ur", "ur", 1, 1, "ur-PK",
    ["ur", "en"]),
  ROW("BD", "Bangladesh", "bn", "en", 1, 1, "bn-IN",
    ["bn", "en"]),
  ROW("SA", "Saudi Arabia", "ar", "en", 4, 0, "ar-SA",
    ["ar", "en"]),
  ROW("AE", "UAE", "ar", "en", 16, 0, "ar-SA",
    ["ar", "en"]),
  ROW("QA", "Qatar", "ar", "en", 10, 0, "ar-SA",
    ["ar", "en"]),
  ROW("TR", "Türkiye", "tr", "en", 13, 0, "tr-TR",
    ["tr", "en"]),
  ROW("ID", "Indonesia", "id", "en", 20, 0, "id-ID",
    ["id", "en"]),
  ROW("NA", "North America", "en", "en", 2, 0, "en-US",
    ["en"]),
  ROW("GB", "United Kingdom", "en", "en", 3, 0, "en-GB",
    ["en"]),
  ROW("OTHER", "Other", "en", "en", 1, 1, "en-IN", ["en"]),
];

const TZ_MAP: Record<string, string> = {
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE", "Asia/Qatar": "QA", "Europe/Istanbul": "TR",
  "Asia/Jakarta": "ID", "Europe/London": "GB",
};

// Browser-language primary subtag -> answer-language override (clear mappings only).
const NAV_LANG: Record<string, string> = { ur: "ur", bn: "bn", ar: "ar", tr: "tr", hi: "hi", id: "id", ms: "id" };

export function regionByCode(code: string): RegionRow {
  return REGION_ROWS.find(r => r.code === code) ?? REGION_ROWS[0];
}

export function detectRegion(): RegionRow {
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* keep default */ }
  let code = TZ_MAP[tz];
  if (!code && tz.startsWith("America/")) code = "NA";
  const base = regionByCode(code ?? "IN");
  let nav = "";
  try { nav = (navigator.language || "").toLowerCase().split("-")[0]; } catch { /* keep base */ }
  const over = NAV_LANG[nav];
  if (over && over !== base.answerLang)
    return { ...base, answerLang: over, voiceLocale: REPLY_LANGS[over]?.locale ?? base.voiceLocale };
  return base;
}

export const METHOD_OPTIONS: [number, string][] = [
  [1, "University of Islamic Sciences, Karachi"],
  [2, "ISNA, North America"],
  [3, "Muslim World League"],
  [4, "Umm al-Qura, Makkah"],
  [5, "Egyptian General Authority"],
  [13, "Diyanet, Türkiye"],
  [16, "UAE"],
  [10, "Qatar"],
  [20, "Kemenag, Indonesia"],
];
export const methodName = (n: number) => METHOD_OPTIONS.find(([v]) => v === n)?.[1] ?? `Method ${n}`;

// Answer-language options for a region: that region's languages, in region
// order, names from REPLY_LANGS. English is in every region's list by design.
export function answerLangOptionsForRegion(regionCode: string): { code: string; name: string }[] {
  const row = regionByCode(regionCode);
  const seen = new Set<string>();
  const out: { code: string; name: string }[] = [];
  for (const code of row.languages) {
    if (seen.has(code)) continue;
    seen.add(code);
    const name = REPLY_LANGS[code]?.name;
    if (name) out.push({ code, name });
  }
  return out;
}

// The full reply-language catalog, for the "All languages" group in selectors.
export const ALL_ANSWER_LANG_OPTIONS: { code: string; name: string }[] =
  Object.entries(REPLY_LANGS).map(([code, v]) => ({ code, name: v.name }));

export type Prefs = {
  answerLang: string;        // 'auto' = follow the detected region language
  translationLang: string;   // 'en' | 'hi' | 'ur'
  region: string;            // region code, e.g. 'IN'
  prayerMethod: number;      // Aladhan calculation method 0..24
  prayerSchool: number;      // 0 = Shafi'i, 1 = Hanafi
  azaan?: boolean;           // azaan reminder preference (mirrors the 'azaan' key)
  detected: RegionRow;
};

const KEY = "dalil_prefs";

function readPrefs(overrides?: Partial<Prefs>): Prefs {
  const detected = detectRegion();
  let stored: Partial<Prefs> | null = null;
  try { const raw = localStorage.getItem(KEY); if (raw) stored = JSON.parse(raw) as Partial<Prefs>; } catch { /* fresh */ }
  const s: Partial<Prefs> = { ...(stored ?? {}), ...(overrides ?? {}) };
  return {
    answerLang: typeof s.answerLang === "string" ? s.answerLang : "auto",
    translationLang: typeof s.translationLang === "string" ? s.translationLang : detected.translationLang,
    region: typeof s.region === "string" ? s.region : detected.code,
    prayerMethod: typeof s.prayerMethod === "number" ? s.prayerMethod : detected.prayerMethod,
    prayerSchool: typeof s.prayerSchool === "number" ? s.prayerSchool : detected.prayerSchool,
    azaan: typeof s.azaan === "boolean" ? s.azaan : undefined,
    detected,
  };
}

export function getPrefs(): Prefs {
  let has = false;
  try { has = !!localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  const p = readPrefs();
  if (!has) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } }
  return p;
}

export function savePrefs(partial: Partial<Prefs>): Prefs {
  const p = readPrefs(partial);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
  return p;
}

// The language the AI should answer in for these prefs ('auto' follows detection).
export function effectiveAnswerLang(prefs: Prefs): string {
  return prefs.answerLang === "auto" ? prefs.detected.answerLang : prefs.answerLang;
}
