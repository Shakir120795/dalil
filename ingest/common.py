import os
from supabase import create_client
from sentence_transformers import SentenceTransformer

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
_model = None
def embed(texts):
    global _model
    _model = _model or SentenceTransformer("BAAI/bge-m3")
    return _model.encode(texts, batch_size=16, normalize_embeddings=True).tolist()

def batched(rows, n):
    for i in range(0, len(rows), n):
        yield rows[i:i+n]

def upsert(table, rows, conflict):
    for b in batched(rows, 200):
        sb.table(table).upsert(b, on_conflict=conflict).execute()

def license_row(edition, url, licence, attribution):
    # verified=False: commercial launch se pehle khud check karke True karna
    sb.table("licenses").upsert({"edition": edition, "source_url": url,
        "licence": licence, "attribution": attribution}, on_conflict="edition").execute()
