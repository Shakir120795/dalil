// Hinglish/Roman Urdu -> English/Arabic terms. Yahan words badhate jao (questions_log dekh ke).
const GROUPS: Record<string, string[]> = {
  namaz:  ["namaz","namaaz","salah","salat","prayer","pray"],
  wudu:   ["wudu","wuzu","vuzu","wazu","ablution"],
  ghusl:  ["ghusl","gusl","bath","purification","janabah"],
  roza:   ["roza","roze","rozah","saum","sawm","fasting","fast"],
  zakat:  ["zakat","zakaat","zakah","charity","alms"],
  hajj:   ["hajj","haj","pilgrimage"],
  umrah:  ["umrah","umra"],
  talaq:  ["talaq","talak","divorce"],
  nikah:  ["nikah","nikaah","marriage","marry"],
  riba:   ["sood","riba","interest","usury"],
  haram:  ["haram","forbidden","prohibited"],
  halal:  ["halal","lawful","permissible"],
  sajda:  ["sajda","sajdah","sujood","prostration"],
  janaza: ["janaza","janazah","funeral"],
  dua:    ["dua","duaa","supplication"],
  gunah:  ["gunah","gunaah","sin","sins"],
  tauba:  ["tauba","toba","repentance","repent"],
  jannat: ["jannat","jannah","paradise"],
  jahannam: ["jahannam","dozakh","hell","hellfire"],
  sabr:   ["sabr","patience","patient"],
  maa:    ["maa","walida","mother","parents"],
  qurbani:["qurbani","udhiya","sacrifice"],
  quran:  ["quran","qoran","koran"],
};
const TOPICS: Record<string, string> = {
  namaz:"namaz", wudu:"namaz", ghusl:"purity", sajda:"namaz", roza:"roza", zakat:"zakat", hajj:"hajj", umrah:"hajj",
  talaq:"nikah-talaq", nikah:"nikah-talaq", riba:"halal-haram", haram:"halal-haram", halal:"halal-haram",
  janaza:"janaza", dua:"dua", gunah:"gunah-tauba", tauba:"gunah-tauba", jannat:"akhirah", jahannam:"akhirah",
};
const index = new Map<string, string>();
for (const [k, words] of Object.entries(GROUPS)) words.forEach(w => index.set(w, k));
const STOP = new Set(["kya","hai","hain","ka","ki","ke","me","mein","se","ko","kaise","kab","kyun","to","or","aur","the","is","are","what","how","of","in","a","an","and","for","can","do","i","my","kar","karna","kare","sakte","sakta"]);

export function expand(q: string) {
  const tokens = q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const terms = new Set<string>(); let topic = "other";
  for (const t of tokens) {
    const g = index.get(t);
    if (g) { GROUPS[g].forEach(w => terms.add(w)); if (topic === "other" && TOPICS[g]) topic = TOPICS[g]; }
    else if (!STOP.has(t) && t.length > 2) terms.add(t);
  }
  const list = [...terms];
  return { text: list.join(" "), tsquery: list.join(" | "), topic };
}
