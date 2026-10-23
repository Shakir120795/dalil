"""Hadith: Bukhari + Muslim (sahih collections). Source: fawazahmed0/hadith-api (editions ka licence check karo)."""
import os, requests
LIMIT = int(os.environ.get("LIMIT", 0))  # test ke liye: LIMIT=300
from tqdm import tqdm
from common import embed, upsert, batched, license_row

CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/"
def get(ed):
    r = requests.get(f"{CDN}{ed}.json", timeout=120)
    return r.json()["hadiths"] if r.ok else []

for book in ["bukhari", "muslim"]:
    en, ar, hi, ur = get(f"eng-{book}"), get(f"ara-{book}"), get(f"hin-{book}"), get(f"urd-{book}")
    print(book, "eng", len(en), "ara", len(ar), "hin", len(hi))
    for ed in (f"eng-{book}", f"ara-{book}", f"hin-{book}", f"urd-{book}"):
        license_row(ed, CDN + ed + ".json", "CHECK edition licence", f"Sahih {book.title()} via hadith-api")
    for lang, items in (("ar", ar), ("hi", hi), ("ur", ur)):
        upsert("display", [{"ref": f"{book}:{h['hadithnumber']}", "lang": lang, "content": h["text"]}
                           for h in items if h["text"].strip()], "ref,lang")
    en = [h for h in en if h["text"].strip()]
    en = en[:LIMIT] if LIMIT else en
    for b in tqdm(list(batched(en, 32)), desc=book):
        vecs = embed([h["text"] for h in b])
        upsert("chunks", [{"source": book, "ref": f"{book}:{h['hadithnumber']}", "content": h["text"],
            "meta": {"grades": h.get("grades", []), "book": (h.get("reference") or {}).get("book")},
            "embedding": v} for h, v in zip(b, vecs)], "source,ref")
