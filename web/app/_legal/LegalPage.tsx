import { LEGAL } from "@/lib/legal";
export type Section = [string, string[]];
export default function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return (
    <main>
      <h1>{title}</h1>
      <p className="sub">Last updated: {LEGAL.updated}</p>
      <p>{intro}</p>
      {sections.map(([h, paras]) => (
        <section key={h}><h2>{h}</h2>{paras.map((p, i) => <p key={i}>{p}</p>)}</section>
      ))}
      <p className="note"><a href="/">Home</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/refund">Refunds</a></p>
    </main>
  );
}
