// Cheap question-language detection (Unicode script ranges + a few Latin-script markers).
// Used to decide whether a question should be translated to English before retrieval:
// the search corpus is English, while users may ask in any language.
// NOTE: ranges are written as \u escapes on purpose — literal glyphs are error-prone here.

export type DetectedLang = {
  // Best guess at the question language: a REPLY_LANGS code ('en', 'hi', 'hinglish',
  // 'ur', 'ar', 'bn', 'ta', 'te', 'ml', 'kn', 'gu', 'pa', 'id', 'tr', ...) or 'other'
  guess: string;
  // The dominant Unicode script found: 'latin' | 'arabic' | 'devanagari' | 'bengali' |
  // 'tamil' | 'telugu' | 'malayalam' | 'kannada' | 'gujarati' | 'gurmukhi' | 'cyrillic' | 'other'
  script: string;
  // True when translating to English first will clearly help retrieval.
  needsTranslation: boolean;
};

type ScriptRange = { re: RegExp; script: string; guess: string };

const SCRIPTS: ScriptRange[] = [
  { re: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/, script: "arabic", guess: "ar" },  // Arabic script (Arabic, Urdu, Persian, Pashto, Sindhi...)
  { re: /[\u0900-\u097F]/, script: "devanagari", guess: "hi" },  // Devanagari (Hindi, Marathi...)
  { re: /[\u0980-\u09FF]/, script: "bengali", guess: "bn" },  // Bengali / Assamese
  { re: /[\u0B80-\u0BFF]/, script: "tamil", guess: "ta" },  // Tamil
  { re: /[\u0C00-\u0C7F]/, script: "telugu", guess: "te" },  // Telugu
  { re: /[\u0D00-\u0D7F]/, script: "malayalam", guess: "ml" },  // Malayalam
  { re: /[\u0C80-\u0CFF]/, script: "kannada", guess: "kn" },  // Kannada
  { re: /[\u0A80-\u0AFF]/, script: "gujarati", guess: "gu" },  // Gujarati
  { re: /[\u0A00-\u0A7F]/, script: "gurmukhi", guess: "pa" },  // Gurmukhi (Punjabi)
  { re: /[\u0400-\u04FF]/, script: "cyrillic", guess: "other" },  // Cyrillic
  { re: /[\u0590-\u05FF]/, script: "other", guess: "other" },  // Hebrew
  { re: /[\u4E00-\u9FFF]/, script: "other", guess: "other" },  // CJK
  { re: /[\u3040-\u30FF]/, script: "other", guess: "other" },  // Japanese kana
  { re: /[\uAC00-\uD7AF]/, script: "other", guess: "other" },  // Hangul
];

// Latin-script languages that still benefit from translation before retrieval.
// Strong function words only, so ordinary English questions are not misdetected.
const HINGLISH_MARKERS = new Set(["kya", "hai", "hain", "kaise", "kyun", "kyon", "kab", "mera", "meri", "mere",
  "mujhe", "tumhe", "chahiye", "batao", "bataiye", "hota", "hoti", "hote", "karna", "karke", "wala", "wali",
  "kisko", "kisne", "kitna", "kitne", "kidhar", "udhar", "matlab", "samjhao", "milega", "hoga", "hogi"]);
const INDONESIAN_MARKERS = new Set(["apa", "apakah", "bagaimana", "yang", "dan", "dalam", "untuk", "dengan",
  "saya", "aku", "tidak", "boleh", "harus", "ketika", "mengapa", "kenapa", "hukumnya", "adalah", "cara"]);
const TURKISH_CHARS = /[\u0131\u015F\u011F\u0130]/;  // dotless i / s-cedilla / g-breve are distinctive for Turkish

export function detectLang(q: string): DetectedLang {
  const counts = new Map<string, { n: number; guess: string }>();
  let latin = 0;
  for (const ch of q) {
    if (/[a-zA-Z]/.test(ch)) { latin++; continue; }
    for (const s of SCRIPTS) {
      if (s.re.test(ch)) {
        const c = counts.get(s.script) ?? { n: 0, guess: s.guess };
        c.n++; counts.set(s.script, c);
        break;
      }
    }
  }
  let dom: { script: string; guess: string; n: number } | null = null;
  for (const [script, c] of counts) if (!dom || c.n > dom.n) dom = { script, guess: c.guess, n: c.n };
  // A non-Latin script wins when it is clearly present relative to the Latin text.
  if (dom && dom.n >= 3 && dom.n * 2 >= latin) {
    return { guess: dom.guess, script: dom.script, needsTranslation: true };
  }
  // Latin script: look for language markers. Marker hits are counted per DISTINCT
  // word, and the Hinglish markers are strong Hindi function words, so ordinary
  // English questions ("What is the ruling on music?") never reach the threshold.
  const tokens = q.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const hits = (set: Set<string>) => new Set(tokens.filter(t => set.has(t))).size;
  if (TURKISH_CHARS.test(q)) return { guess: "tr", script: "latin", needsTranslation: true };
  // Roman-script Hindi with no Devanagari present = Hinglish (its own reply language).
  if (hits(HINGLISH_MARKERS) >= 2) return { guess: "hinglish", script: "latin", needsTranslation: true };
  if (hits(INDONESIAN_MARKERS) >= 2) return { guess: "id", script: "latin", needsTranslation: true };
  if (dom && dom.n >= 2) return { guess: dom.guess, script: dom.script, needsTranslation: true };
  return { guess: "en", script: "latin", needsTranslation: false };
}

// Languages the user can explicitly pick for the AI's replies (chat UI + profile).
// `locale` drives voice input (Web Speech API). Region-specific subsets live in
// web/lib/region.ts; English is always offered in every region.
export const REPLY_LANGS: Record<string, { name: string; locale: string }> = {
  en: { name: "English", locale: "en-IN" },
  hi: { name: "Hindi", locale: "hi-IN" },
  hinglish: { name: "Hinglish (Roman Hindi)", locale: "hi-IN" },
  ur: { name: "Urdu", locale: "ur-PK" },
  ar: { name: "Arabic", locale: "ar-SA" },
  bn: { name: "Bengali", locale: "bn-IN" },
  ta: { name: "Tamil", locale: "ta-IN" },
  te: { name: "Telugu", locale: "te-IN" },
  ml: { name: "Malayalam", locale: "ml-IN" },
  mr: { name: "Marathi", locale: "mr-IN" },
  pa: { name: "Punjabi", locale: "pa-IN" },
  gu: { name: "Gujarati", locale: "gu-IN" },
  kn: { name: "Kannada", locale: "kn-IN" },
  ps: { name: "Pashto", locale: "ps-AF" },
  sd: { name: "Sindhi", locale: "sd-PK" },
  tr: { name: "Turkish", locale: "tr-TR" },
  id: { name: "Indonesian", locale: "id-ID" },
  es: { name: "Spanish", locale: "es-ES" },
};

export function validReplyLang(v: unknown): string {
  return typeof v === "string" && (v === "auto" || v in REPLY_LANGS) ? v : "auto";
}
