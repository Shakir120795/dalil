// Canonical per-topic suggestion questions + labels, localized for the 8 UI
// languages. Pure module (no client/server-only imports) so both the
// /api/suggestions route and the home page can share one source of truth.
// Real frequent questions from the logs pass through unchanged (they are
// already in the users' own languages) — only these canonical ones localize.

export const UI_LANGS = ["en", "hi", "hinglish", "ur", "ar", "bn", "tr", "id"] as const;
export type UiLang = (typeof UI_LANGS)[number];

export function validUiLang(v: string | null | undefined): UiLang {
  return v && (UI_LANGS as readonly string[]).includes(v) ? (v as UiLang) : "en";
}

type LangMap = Partial<Record<UiLang, string>> & { en: string };

export function pick(m: LangMap, lang: UiLang): string {
  return m[lang] ?? m.en;
}

export const TOPICS = [
  "namaz", "purity", "roza", "zakat", "hajj", "nikah-talaq",
  "halal-haram", "janaza", "dua", "gunah-tauba", "akhirah",
] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABEL: Record<Topic, LangMap> = {
  "namaz": { en: "Prayer", hi: "नमाज़", hinglish: "Namaz", ur: "نماز", ar: "الصلاة", bn: "নামাজ", tr: "Namaz", id: "Salat" },
  "purity": { en: "Purification", hi: "पाकी", hinglish: "Taharat", ur: "طہارت", ar: "الطهارة", bn: "পবিত্রতা", tr: "Temizlik", id: "Kesucian" },
  "roza": { en: "Fasting", hi: "रोज़ा", hinglish: "Roza", ur: "روزہ", ar: "الصيام", bn: "রোজা", tr: "Oruç", id: "Puasa" },
  "zakat": { en: "Zakat", hi: "ज़कात", hinglish: "Zakat", ur: "زکاۃ", ar: "الزكاة", bn: "যাকাত", tr: "Zekât", id: "Zakat" },
  "hajj": { en: "Hajj", hi: "हज", hinglish: "Hajj", ur: "حج", ar: "الحج", bn: "হজ", tr: "Hac", id: "Haji" },
  "nikah-talaq": { en: "Marriage & Family", hi: "शादी और परिवार", hinglish: "Shaadi aur parivaar", ur: "شادی و خاندان", ar: "الزواج والأسرة", bn: "বিয়ে ও পরিবার", tr: "Evlilik ve aile", id: "Pernikahan & keluarga" },
  "halal-haram": { en: "Halal & Haram", hi: "हलाल और हराम", hinglish: "Halal aur Haram", ur: "حلال و حرام", ar: "الحلال والحرام", bn: "হালাল ও হারাম", tr: "Helal ve haram", id: "Halal & haram" },
  "janaza": { en: "Funeral", hi: "जनाज़ा", hinglish: "Janaza", ur: "جنازہ", ar: "الجنازة", bn: "জানাজা", tr: "Cenaze", id: "Jenazah" },
  "dua": { en: "Dua", hi: "दुआ", hinglish: "Dua", ur: "دعا", ar: "الدعاء", bn: "দোয়া", tr: "Dua", id: "Doa" },
  "gunah-tauba": { en: "Repentance", hi: "तौबा", hinglish: "Tauba", ur: "توبہ", ar: "التوبة", bn: "তওবা", tr: "Tövbe", id: "Tobat" },
  "akhirah": { en: "Hereafter", hi: "आख़िरत", hinglish: "Aakhirat", ur: "آخرت", ar: "الآخرة", bn: "আখিরাত", tr: "Ahiret", id: "Akhirat" },
};

export const POPULAR_LABEL: LangMap = {
  en: "Popular", hi: "लोकप्रिय", hinglish: "Popular", ur: "مقبول",
  ar: "شائع", bn: "জনপ্রিয়", tr: "Popüler", id: "Populer",
};

export const TOPIC_QUESTION: Record<Topic, LangMap> = {
  "namaz": {
    en: "What are the conditions of a valid prayer?",
    hi: "सही नमाज़ की शर्तें क्या हैं?",
    hinglish: "Sahi namaz ki sharten kya hain?",
    ur: "صحیح نماز کی شرائط کیا ہیں؟",
    ar: "ما هي شروط صحة الصلاة؟",
    bn: "সহীহ নামাজের শর্তগুলো কী কী?",
    tr: "Geçerli bir namazın şartları nelerdir?",
    id: "Apa saja syarat sah salat?",
  },
  "purity": {
    en: "What breaks wudu?",
    hi: "वुज़ू किससे टूटता है?",
    hinglish: "Wuzu kis se toot-ta hai?",
    ur: "وضو کس چیز سے ٹوٹتا ہے؟",
    ar: "ما الذي ينقض الوضوء؟",
    bn: "কী কী কারণে ওজু ভেঙে যায়?",
    tr: "Abdesti ne bozar?",
    id: "Apa saja yang membatalkan wudu?",
  },
  "roza": {
    en: "What breaks a fast?",
    hi: "रोज़ा किससे टूटता है?",
    hinglish: "Roza kis se toot-ta hai?",
    ur: "روزہ کس چیز سے ٹوٹتا ہے؟",
    ar: "ما الذي يفطر الصائم؟",
    bn: "কী কী কারণে রোজা ভেঙে যায়?",
    tr: "Orucu ne bozar?",
    id: "Apa saja yang membatalkan puasa?",
  },
  "zakat": {
    en: "Who must pay zakat, and how much?",
    hi: "ज़कात किस पर फ़र्ज़ है, और कितनी?",
    hinglish: "Zakat kis par farz hai, aur kitni?",
    ur: "زکاۃ کس پر فرض ہے، اور کتنی؟",
    ar: "على من تجب الزكاة، وكم مقدارها؟",
    bn: "কার উপর যাকাত ফরজ, এবং কতটুকু?",
    tr: "Zekât kimlere farzdır ve miktarı ne kadardır?",
    id: "Siapa yang wajib membayar zakat, dan berapa jumlahnya?",
  },
  "hajj": {
    en: "What are the steps of Hajj?",
    hi: "हज कैसे किया जाता है?",
    hinglish: "Hajj kaise kiya jata hai?",
    ur: "حج کیسے کیا جاتا ہے؟",
    ar: "ما هي مناسك الحج؟",
    bn: "হজ কীভাবে করা হয়?",
    tr: "Hac nasıl yapılır?",
    id: "Bagaimana tata cara haji?",
  },
  "nikah-talaq": {
    en: "What are the rights of spouses in Islam?",
    hi: "इस्लाम में पति-पत्नी के हक़ क्या हैं?",
    hinglish: "Islam me shohar-biwi ke huqooq kya hain?",
    ur: "اسلام میں میاں بیوی کے حقوق کیا ہیں؟",
    ar: "ما هي حقوق الزوجين في الإسلام؟",
    bn: "ইসলামে স্বামী-স্ত্রীর হক কী কী?",
    tr: "İslam'da eşlerin birbirleri üzerindeki hakları nelerdir?",
    id: "Apa saja hak suami istri dalam Islam?",
  },
  "halal-haram": {
    en: "Is interest (riba) haram?",
    hi: "क्या ब्याज (रिबा) हराम है?",
    hinglish: "Kya byaaj (riba) haram hai?",
    ur: "کیا سود (ربا) حرام ہے؟",
    ar: "هل الربا حرام؟",
    bn: "সুদ (রিবা) কি হারাম?",
    tr: "Faiz (riba) haram mıdır?",
    id: "Apakah bunga (riba) haram?",
  },
  "janaza": {
    en: "How is the funeral prayer performed?",
    hi: "जनाज़े की नमाज़ कैसे पढ़ी जाती है?",
    hinglish: "Janaze ki namaz kaise padhi jati hai?",
    ur: "نماز جنازہ کیسے پڑھی جاتی ہے؟",
    ar: "كيف تُصلّى صلاة الجنازة؟",
    bn: "জানাজার নামাজ কীভাবে পড়া হয়?",
    tr: "Cenaze namazı nasıl kılınır?",
    id: "Bagaimana cara salat jenazah?",
  },
  "dua": {
    en: "What is the best time to make dua?",
    hi: "दुआ करने का सबसे अच्छा समय कौन सा है?",
    hinglish: "Dua karne ka sabse achha time kaun sa hai?",
    ur: "دعا کرنے کا بہترین وقت کون سا ہے؟",
    ar: "ما هو أفضل وقت للدعاء؟",
    bn: "দোয়া করার সেরা সময় কোনটি?",
    tr: "Dua etmek için en iyi zaman hangisidir?",
    id: "Kapan waktu terbaik untuk berdoa?",
  },
  "gunah-tauba": {
    en: "How do I repent from a sin?",
    hi: "गुनाह से तौबा कैसे करें?",
    hinglish: "Gunah se tauba kaise karen?",
    ur: "گناہ سے توبہ کیسے کریں؟",
    ar: "كيف أتوب من الذنب؟",
    bn: "গুনাহ থেকে তওবা কীভাবে করব?",
    tr: "Bir günahtan nasıl tövbe edilir?",
    id: "Bagaimana cara bertobat dari dosa?",
  },
  "akhirah": {
    en: "What happens after death in Islam?",
    hi: "इस्लाम में मौत के बाद क्या होता है?",
    hinglish: "Islam me maut ke baad kya hota hai?",
    ur: "اسلام میں موت کے بعد کیا ہوتا ہے؟",
    ar: "ماذا يحدث بعد الموت في الإسلام؟",
    bn: "ইসলামে মৃত্যুর পর কী হয়?",
    tr: "İslam'da ölümden sonra ne olur?",
    id: "Apa yang terjadi setelah kematian dalam Islam?",
  },
};

// Fallback-only variant (the "virtues of fasting" question used by the
// default chip set, instead of the canonical "what breaks a fast").
export const ROZA_VIRTUES: LangMap = {
  en: "What are the virtues of fasting?",
  hi: "रोज़े की फ़ज़ीलतें क्या हैं?",
  hinglish: "Roze ki fazeelaten kya hain?",
  ur: "روزے کی فضیلتیں کیا ہیں؟",
  ar: "ما هي فضائل الصيام؟",
  bn: "রোজার ফজিলত কী কী?",
  tr: "Orucun faziletleri nelerdir?",
  id: "Apa saja keutamaan puasa?",
};

export type Chip = { text: string; topic: string };

/** The default chip set (used when there is too little log data), localized. */
export function fallbackChips(lang: UiLang): Chip[] {
  return [
    { text: pick(TOPIC_QUESTION["purity"], lang), topic: pick(TOPIC_LABEL["purity"], lang) },
    { text: pick(TOPIC_QUESTION["zakat"], lang), topic: pick(TOPIC_LABEL["zakat"], lang) },
    { text: pick(ROZA_VIRTUES, lang), topic: pick(TOPIC_LABEL["roza"], lang) },
    { text: pick(TOPIC_QUESTION["halal-haram"], lang), topic: pick(TOPIC_LABEL["halal-haram"], lang) },
  ];
}

/** One canonical chip for a topic, localized. */
export function canonicalChip(topic: Topic, lang: UiLang): Chip {
  return { text: pick(TOPIC_QUESTION[topic], lang), topic: pick(TOPIC_LABEL[topic], lang) };
}
