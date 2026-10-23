// Tappable follow-up chips shown after an answer (topic comes from synonyms.ts)
const F: Record<string, string[]> = {
  "namaz": ["What is the correct way to pray?", "What are the most common mistakes in prayer?", "What is the ruling on making up missed prayers (qaza)?"],
  "purity": ["What breaks wudu?", "When does ghusl become obligatory?", "How is tayammum performed?"],
  "roza": ["What breaks the fast?", "What are the times for sehri and iftar?", "What are the virtues of fasting?"],
  "zakat": ["What is the nisab for zakat?", "Who is eligible to receive zakat?", "When does zakat become obligatory?"],
  "hajj": ["What are the obligatory acts of Hajj?", "How is Umrah performed?", "Who is obliged to perform Hajj?"],
  "nikah-talaq": ["What are the conditions of a valid nikah?", "What is the correct procedure for talaq?", "What is the ruling on mehr (dower)?"],
  "halal-haram": ["Why is interest (riba) forbidden?", "What are the virtues of halal earnings?", "How can I stay away from what is haram?"],
  "janaza": ["How is the funeral prayer offered?", "What are the rulings on burial?", "What is eesal-e-sawab (sending reward to the deceased)?"],
  "dua": ["At what times are duas most likely to be accepted?", "What are the morning and evening duas?", "What is the correct way to make dua?"],
  "gunah-tauba": ["What is the correct way to repent?", "How can I protect myself from sin?", "What are the virtues of repentance?"],
  "akhirah": ["What are the blessings of Paradise?", "What are the signs of the Day of Judgement?", "What is said about the punishment of Hell?"],
  "other": ["Show me the evidence for this in detail", "What do the hadith say about this?", "What precautions apply in this matter?"],
};
export function followups(topic: string): string[] { return F[topic] ?? F.other; }
