"""Fiqh kitab ingest. SIRF wahi text daalo jiska licence/permission clear ho.
Input JSONL, har line: {"book":"Hidaya","madhab":"hanafi","ref":"1.2.3","chapter":"Kitab al-Tahara","text":"..."}
Usage: python ingest_fiqh.py book.jsonl --licence "Public domain" --attribution "Translator, Year" --source-url URL"""
import argparse, json, re
from tqdm import tqdm
from common import embed, upsert, batched, license_row

ap = argparse.ArgumentParser()
ap.add_argument("file"); ap.add_argument("--licence", required=True)
ap.add_argument("--attribution", required=True); ap.add_argument("--source-url", default="")
a = ap.parse_args()

def pieces(text, n=1200):
    out, cur = [], ""
    for para in re.split(r"\n\s*\n", text.strip()):
        if len(cur) + len(para) > n and cur: out.append(cur); cur = ""
        cur += (" " if cur else "") + para
    return out + ([cur] if cur else [])

rows, book = [], None
for line in open(a.file, encoding="utf-8"):
    if not line.strip(): continue
    j = json.loads(line); book = book or j["book"]
    for i, p in enumerate(pieces(j["text"])):
        rows.append({"source": f"fiqh:{re.sub(r'[^a-z0-9]+','-',j['book'].lower())}", "ref": f"{j['book']}:{j['ref']}" + (f".{i+1}" if i else ""),
                     "content": p, "meta": {"book": j["book"], "madhab": j.get("madhab"), "chapter": j.get("chapter")}})
license_row(f"fiqh:{book}", a.source_url, a.licence, a.attribution)
for b in tqdm(list(batched(rows, 32))):
    vecs = embed([r["content"] for r in b])
    upsert("chunks", [{**r, "embedding": v} for r, v in zip(b, vecs)], "source,ref")
print(len(rows), "chunks ingest hue")
