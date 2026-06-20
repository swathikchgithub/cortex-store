# Demo Script — Cortex Store

A guided walkthrough of the live app. Takes about 5 minutes end-to-end.

**Live app:** https://cortex-store-sigma.vercel.app

---

## Before You Start

Confirm the stack is running locally:

```bash
# Weaviate should be healthy
docker ps | grep weaviate

# Next.js dev server on :3000
npm run dev
```

Check document count via the API:

```bash
curl http://localhost:3000/api/count
# {"ok":true,"count":10}
```

If count is 0, seed first:

```bash
npx tsx scripts/seed.ts
# Skips automatically if documents already exist
```

---

## Step 1 — The Problem (30 seconds)

Open [http://localhost:3000](http://localhost:3000) (or the live Vercel URL).

Point to the document count in the header subtitle — "10 documents indexed".

> "Standard search engines match exact words. If a document uses 'automobile' and you
> search for 'car', you get nothing. Cortex Store searches for *meaning* — using vector
> embeddings to represent what text is about, not just what words it contains."

---

## Step 2 — Semantic Search (1 minute)

Make sure **Semantic** mode is selected (default).

Type each query and show the results:

| Query | Expected top result |
|---|---|
| `graph based index for fast lookup` | HNSW document |
| `which AI model is cheapest for text` | OpenAI embeddings document |
| `question answering with external knowledge` | RAG document |

> "None of those queries share words with the documents they found. The match happens
> because the query vector and document vector are close in 1536-dimensional space —
> they represent the same concept."

---

## Step 3 — Similarity Scores (30 seconds)

Point to the percentage badge on each result card.

> "That score is cosine certainty — how directionally aligned the query vector is with
> the document vector. Green (85%+) is a strong semantic match. Yellow (70–85%) is
> related. Results below 60% are filtered out entirely."

---

## Step 4 — Hybrid Search (1 minute)

Click **Hybrid (semantic + keyword)** toggle.

Search for `BM25`.

> "BM25 is a specific term — it appears verbatim in one document. Pure vector search
> might miss it because 'BM25' doesn't have strong semantic neighbors. Hybrid mode
> blends vector similarity with keyword matching, so exact terms still surface. The
> score badge switches from a percentage to a fusion score."

Switch back to **Semantic** and search `BM25` — show that it still finds the document
but may rank it differently.

---

## Step 5 — The Raw API (1 minute)

Open a terminal:

```bash
# Semantic search
curl "http://localhost:3000/api/search?q=memory+usage+of+vectors&mode=semantic" \
  | python3 -m json.tool

# Hybrid search
curl "http://localhost:3000/api/search?q=BM25&mode=hybrid" \
  | python3 -m json.tool

# Document count
curl "http://localhost:3000/api/count"
```

> "Each result has title, content, source, and a score. The whole round trip —
> embed via OpenAI, ANN search in Weaviate, return ranked results — is under 300ms."

---

## Step 6 — Live Ingestion (1 minute)

```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INGEST_SECRET" \
  -d '{
    "title": "pgvector as a lightweight alternative",
    "content": "pgvector is a PostgreSQL extension that adds vector similarity search. It uses exact nearest neighbor search rather than approximate, making it slower at scale but simpler to operate if you are already running Postgres.",
    "source": "live-demo"
  }'
```

Refresh the page — the header should now show "11 documents indexed".

Search `postgres extension for embeddings` — the new document appears immediately.

> "No reindexing step. The ingest route embeds the document, stores it in Weaviate,
> and it's immediately searchable. The count in the header updates on page load."

---

## Step 7 — Architecture Summary (1 minute)

```
Browser → Next.js API routes (Vercel)
                ↓
          OpenAI API  ← converts text to 1536-dim vectors
                ↓
          Weaviate (Railway) ← stores documents + HNSW index (API key auth)
                ↓
          Upstash Redis ← rate limiting (20 req/min search, 5 req/min ingest)
                ↓
          Sentry ← error monitoring + performance tracing
```

> "Five components. Next.js is stateless on Vercel. OpenAI provides embeddings.
> Weaviate is the only stateful piece — owns the document store and HNSW index,
> locked down with API key auth. Upstash enforces rate limits. Sentry catches errors.
> Total infrastructure cost is under $3/month."

---

## Common Questions

**Why not Elasticsearch or keyword search?**
Keyword search misses synonyms and paraphrases. A query for "vehicle" won't match a document about "cars". Vector search finds semantic neighbors regardless of vocabulary.

**Why Weaviate over Pinecone or pgvector?**
Weaviate self-hosts on Railway, supports hybrid search out of the box, and costs under $3/month. Pinecone is managed but costs more. pgvector is great if you're on Postgres already — but it does exact search, which slows past ~1M vectors.

**Why hybrid search?**
Vector search can miss specific identifiers — product codes, acronyms, proper nouns. Hybrid blends BM25 keyword matching with vector similarity so both exact and semantic queries work well.

**How is the ingest endpoint protected?**
`POST /api/ingest` and `DELETE /api/documents/:id` require `Authorization: Bearer <INGEST_SECRET>`. Requests without the correct token return 401 immediately.

**What happens at 10 million vectors?**
The HNSW index no longer fits in RAM. You'd need Weaviate's distributed mode or Milvus. Ingestion would need async pipelining. This project targets datasets under 10,000 vectors.

**Is this production-ready?**
The security posture is solid — Weaviate locked down, rate limiting, bearer token on write endpoints, error monitoring. What's missing for a real product: user authentication, a document management UI, and a UUID store for tracking ingested documents.
