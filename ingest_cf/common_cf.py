"""Ingest helpers — Cloudflare Workers AI (@cf/baai/bge-m3) embedding version.

Original ingest/common.py local SentenceTransformer se embed karta tha; yahan
wahi model Cloudflare API se chalta hai taaki corpus vectors aur live query
vectors (jo app EMBED_PROVIDER=cf se banata hai) ek hi pipeline ke hon.
Secrets sirf env se: SUPABASE_URL, SUPABASE_SERVICE_KEY, CF_ACCOUNT_ID, CF_API_TOKEN.
"""
import os, time
import requests
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
CF_URL = "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/@cf/baai/bge-m3".format(
    os.environ["CF_ACCOUNT_ID"])
CF_HEADERS = {"Authorization": "Bearer " + os.environ["CF_API_TOKEN"],
              "Content-Type": "application/json"}


class QuotaDone(Exception):
    """Cloudflare free quota khatam — jo upsert ho gaya woh bank hai, baaki kal."""


def _normalize(v):
    n = sum(x * x for x in v) ** 0.5 or 1.0
    return [x / n for x in v]


def _cf_call(payload):
    for attempt in range(3):
        r = requests.post(CF_URL, json=payload, headers=CF_HEADERS, timeout=120)
        if r.status_code in (429, 402):
            raise QuotaDone(f"CF status {r.status_code}: {r.text[:120]}")
        if r.ok:
            return r.json()
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"CF embed failed {r.status_code}: {r.text[:200]}")


def embed(texts):
    """List of texts -> list of 1024-dim normalized vectors (bge-m3, CF)."""
    texts = [t[:2000] for t in texts]
    out = []
    try:
        j = _cf_call({"text": texts})
        data = j.get("result", {}).get("data", [])
        if len(data) == len(texts) and data and len(data[0]) == 1024:
            return [_normalize(v) for v in data]
    except QuotaDone:
        raise
    except Exception:
        pass  # batch shape na mile to ek-ek karke
    for t in texts:
        j = _cf_call({"text": t})
        v = j.get("result", {}).get("data", [[]])[0]
        if len(v) != 1024:
            raise RuntimeError(f"CF embed bad shape: {len(v)}")
        out.append(_normalize(v))
    return out


def batched(rows, n):
    for i in range(0, len(rows), n):
        yield rows[i:i + n]


def upsert(table, rows, conflict):
    for b in batched(rows, 200):
        sb.table(table).upsert(b, on_conflict=conflict).execute()


def existing_refs(source):
    """Is source ke chunks jo pehle se DB me hain — rerun par unhe skip karo."""
    refs, off = set(), 0
    while True:
        r = (sb.table("chunks").select("ref").eq("source", source)
             .range(off, off + 999).execute())
        rows = r.data or []
        refs.update(x["ref"] for x in rows)
        if len(rows) < 1000:
            return refs
        off += 1000


def license_row(edition, url, licence, attribution):
    sb.table("licenses").upsert({"edition": edition, "source_url": url,
        "licence": licence, "attribution": attribution}, on_conflict="edition").execute()
