"""Hadith ingest (CF embedder): Sahih Bukhari + Muslim, fawazahmed0/hadith-api.
Usage: python ingest_hadith_cf.py [bukhari|muslim|all]"""
import os, sys, requests
LIMIT = int(os.environ.get("LIMIT", 0))
from tqdm import tqdm
from common_cf import embed, upsert, batched, license_row, existing_refs, QuotaDone

CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/"
def get(ed):
    r = requests.get(f"{CDN}{ed}.json", timeout=120)
    return r.json()["hadiths"] if r.ok else []

which = sys.argv[1] if len(sys.argv) > 1 else "all"
books = ["bukhari", "muslim"] if which == "all" else [which]
for book in books:
    en, ar, hi, ur = get(f"eng-{book}"), get(f"ara-{book}"), get(f"hin-{book}"), get(f"urd-{book}")
    print(book, "eng", len(en), "ara", len(ar), "hin", len(hi), "urd", len(ur))
    for ed in (f"eng-{book}", f"ara-{book}", f"hin-{book}", f"urd-{book}"):
        license_row(ed, CDN + ed + ".json", "CHECK edition licence", f"Sahih {book.title()} via hadith-api")
    for lang, items in (("ar", ar), ("hi", hi), ("ur", ur)):
        upsert("display", [{"ref": f"{book}:{h['hadithnumber']}", "lang": lang, "content": h["text"]}
                           for h in items if h["text"].strip()], "ref,lang")
    en = [h for h in en if h["text"].strip()]
    en = en[:LIMIT] if LIMIT else en
    done = existing_refs(book)
    todo = [h for h in en if f"{book}:{h['hadithnumber']}" not in done]
    print(f"{book}: {len(done)} already in DB, {len(todo)} to embed")
    try:
        for b in tqdm(list(batched(todo, 32)), desc=book):
            vecs = embed([h["text"] for h in b])
            upsert("chunks", [{"source": book, "ref": f"{book}:{h['hadithnumber']}", "content": h["text"],
                "meta": {"grades": h.get("grades", []), "book": (h.get("reference") or {}).get("book")},
                "embedding": v} for h, v in zip(b, vecs)], "source,ref")
    except QuotaDone as e:
        print(f"QUOTA: {e} — rerun tomorrow, progress saved."); sys.exit(0)
print("hadith done")
