"""Quran: Arabic + English(Sahih Intl) + Hindi. English embed hoti hai, Arabic/Hindi display-only.
EDITIONS badal sakte ho: https://api.alquran.cloud/v1/edition"""
import os, requests
LIMIT = int(os.environ.get("LIMIT", 0))  # test ke liye: LIMIT=300
from tqdm import tqdm
from common import embed, upsert, batched, license_row

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

upsert("display", [{"ref": k, "lang": "ar", "content": v[0]} for k, v in ar.items()], "ref,lang")
license_row("ur.jalandhry", API, "CHECK: Fateh Muhammad Jalandhry", "Fateh Muhammad Jalandhry")
upsert("display", [{"ref": k, "lang": "ur", "content": v[0]} for k, v in ur.items()], "ref,lang")
upsert("display", [{"ref": k, "lang": "hi", "content": v[0]} for k, v in hi.items()], "ref,lang")

keys = list(en)[:LIMIT] if LIMIT else list(en)
for b in tqdm(list(batched(keys, 64)), desc="quran embed"):
    vecs = embed([en[k][0] for k in b])
    upsert("chunks", [{"source": "quran", "ref": k, "content": en[k][0],
        "meta": {"surah": en[k][1]}, "embedding": v} for k, v in zip(b, vecs)], "source,ref")
