// node eval/run.mjs http://localhost:3000   -> har sawal pe expected ref/source mila ya nahi
import fs from "fs";
const base = process.argv[2] || "http://localhost:3000";
const qs = JSON.parse(fs.readFileSync(new URL("./questions.json", import.meta.url)));
let ok = 0;
for (const { q, expect } of qs) {
  const j = await (await fetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) })).json();
  const got = (j.cards || []).map(c => `${c.source}:${c.ref.includes(":") && c.source === "quran" ? c.ref : c.ref.split(":")[1]}`.replace("quran:quran","quran"));
  const gotFull = (j.cards || []).map(c => c.source === "quran" ? `quran:${c.ref}` : c.ref);
  const hit = expect.some(e => gotFull.includes(e) || gotFull.some(g => g.startsWith(e + ":")));
  if (hit) ok++;
  console.log(hit ? "PASS" : "FAIL", "|", q, "|", gotFull.join(", ") || "no result");
}
console.log(`${ok}/${qs.length} passed`);
