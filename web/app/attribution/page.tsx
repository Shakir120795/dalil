import { sb } from "@/lib/server";
export const revalidate = 3600;

export default async function Attribution() {
  let rows: any[] = [];
  try {
    const { data } = await sb.from("licenses").select("*").order("edition");
    rows = data ?? [];
  } catch { /* build-time prerender me env nahi hota: khaali render */ }
  return (
    <main>
      <div className="pagehead"><h1>Sources and licences</h1>
      <p className="sub">The texts in this app come from the sources listed below.</p></div>
      {rows.map((l) => (
        <article className="card" key={l.edition}>
          <div className="ref">{l.edition}</div>
          <div>{l.attribution}</div>
          <div className="note">{l.licence}{l.verified ? "" : " (verification pending)"}</div>
          {l.source_url && <div className="note">{l.source_url}</div>}
        </article>
      ))}
      <p className="note"><a href="/">Back to chat</a></p>
    </main>
  );
}
