"""Quran ingest (CF embedder). Source data: api.alquran.cloud editions.
Display: ar/en/hi/ur. Chunks: English (en.sahih) text embedded, source='quran'."""
import os, sys, requests
LIMIT = int(os.environ.get("LIMIT", 0))
from tqdm import tqdm
from common_cf import embed, upsert, batched, license_row, existing_refs, QuotaDone

API = "https://api.alquran.cloud/v1/quran/"
def fetch(ed):
    out = {}
    for s in requests.get(API + ed, timeout=120).json()["data"]["surahs"]:
        for a in s["ayahs"]:
            out[f'{s["number"]}:{a["numberInSurah"]}'] = (a["text"], s["englishName"])
    return out

ar, en, hi, ur = fetch("quran-uthmani"), fetch("en.sahih"), fetch("hi.hindi"), fetch("ur.jalandhry")
license_row("quran-uthmani", API, "Public domain text (Tanzil/alquran.cloud)", "Tanzil.net")
license_row("en.sahih", API, "CHECK: Sahih International", "Sahih International")
license_row("hi.hindi", API, "CHECK: Suhel Farooq Khan & Saifur Rahman Nadwi", "Suhel Farooq Khan, Saifur Rahman Nadwi")
license_row("ur.jalandhry", API, "CHECK: Fateh Muhammad Jalandhry", "Fateh Muhammad Jalandhry")

upsert("display", [{"ref": k, "lang": "ar", "content": v[0]} for k, v in ar.items()], "ref,lang")
upsert("display", [{"ref": k, "lang": "en", "content": v[0]} for k, v in en.items()], "ref,lang")
upsert("display", [{"ref": k, "lang": "hi", "content": v[0]} for k, v in hi.items()], "ref,lang")
upsert("display", [{"ref": k, "lang": "ur", "content": v[0]} for k, v in ur.items()], "ref,lang")

keys = list(en)[:LIMIT] if LIMIT else list(en)
done = existing_refs("quran")
todo = [k for k in keys if k not in done]
print(f"quran: {len(done)} already in DB, {len(todo)} to embed")
try:
    for b in tqdm(list(batched(todo, 64)), desc="quran embed"):
        vecs = embed([en[k][0] for k in b])
        upsert("chunks", [{"source": "quran", "ref": k, "content": en[k][0],
            "meta": {"surah": en[k][1]}, "embedding": v} for k, v in zip(b, vecs)], "source,ref")
except QuotaDone as e:
    print(f"QUOTA: {e} — rerun tomorrow, progress saved."); sys.exit(0)
print("quran done")
