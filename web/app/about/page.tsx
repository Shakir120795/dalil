import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "About Dalil",
  description: "What Dalil is, how it works, where its sources come from, and why it doesn't issue fatwas.",
  alternates: { canonical: "/about" },
};
const FAQ = [
  ["Does Dalil give fatwas?", "No. Dalil simply finds and shows sources from the Quran and Hadith, with their references. For a ruling on a specific matter, please ask a qualified scholar."],
  ["Where do the answers come from?", "From the Quran (Arabic text with translation) and the hadith collections Sahih al-Bukhari and Sahih Muslim. Every result shows its Surah:Ayah reference or hadith number, and the Sources page carries attribution for every edition used."],
  ["Can I ask in plain, everyday language?", "Yes. Just type the way you would say it — for example, \"What breaks wudu?\" If you like, Dalil can also show a Hindi or Urdu translation alongside the English."],
  ["What happens if no source is found?", "Dalil says so plainly — that no direct answer was found in this set of books — and recommends asking a scholar."],
  ["Is Dalil free?", "Yes. Chat is free with a daily limit. The Premium plan gives you unlimited questions."],
];
const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };

export default function About() {
  return (
    <main>
      <h1>About Dalil</h1>
      <p className="sub">Every answer, with its dalil.</p>
      <p>Dalil is an Islamic search app. You type your question in English, and the app shows the closest matching sources from the Quran and Sahih Hadith, each with its exact reference. It also includes prayer times, a Qibla compass and a Ramadan mode.</p>
      {FAQ.map(([q, a]) => (<section key={q}><h2>{q}</h2><p>{a}</p></section>))}
      <p className="note"><a href="/">Ask a question</a> · <a href="/attribution">Sources and licences</a></p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
