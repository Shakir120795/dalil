import os
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()
model = SentenceTransformer("BAAI/bge-m3")
TOKEN = os.environ.get("EMBED_TOKEN", "")

class Q(BaseModel):
    text: str

@app.get("/")
def health(): return {"ok": True}

@app.post("/embed")
def embed(q: Q, authorization: str = Header(default="")):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(401)
    return {"embedding": model.encode(q.text[:500], normalize_embeddings=True).tolist()}
