# Demo Script — Cortex Store

A guided walkthrough of the live app. Takes about 5 minutes end-to-end.

---

## Before You Start

Confirm the stack is running:

```bash
# Weaviate should be healthy
docker ps | grep weaviate

# Next.js dev server on :3000
npm run dev

# Verify documents are loaded (should return count: 10)
curl -s -X POST http://localhost:8080/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Aggregate { Document { meta { count } } } }"}' \
  | python3 -m json.tool
```

If documents aren't loaded, run:

```bash
npx tsx scripts/seed.ts
```

---

## Step 1 — The Problem (30 seconds)

Open [http://localhost:3000](http://localhost:3000).

> "Standard search engines match exact words. If a document uses the word 'automobile'
> and you search for 'car', you get nothing. Cortex Store solves this by searching for
> *meaning* rather than terms — using vector embeddings to represent what text is about,
> not just what words it contains."

---

## Step 2 — Semantic Matching (1 minute)

Type each query into the search box and show the results:

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
> the document vector. Green (85%+) means strong semantic match. Yellow (70–85%) means
> related but not a direct answer. Results below 60% are filtered out entirely rather
> than surfaced as low-confidence noise."

---

## Step 4 — The Raw API (1 minute)

Open a terminal alongside the browser:

```bash
curl "http://localhost:3000/api/search?q=memory+usage+of+vectors" | python3 -m json.tool
```

Show the JSON response:

```json
{
  "ok": true,
  "results": [
    {
      "title": "...",
      "content": "...",
      "source": "seed",
      "certainty": 0.847,
      "distance": 0.153
    }
  ]
}
```

> "Each result carries the title, content, source label, certainty, and raw cosine
> distance. The full round trip — embed the query via OpenAI, run ANN search in
> Weaviate, return ranked results — completes in under 300ms."

---

## Step 5 — Live Ingestion (1 minute)

Ingest a new document in real time:

```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "pgvector as a lightweight alternative",
    "content": "pgvector is a PostgreSQL extension that adds vector similarity search. It uses exact nearest neighbor search rather than approximate, making it slower at scale but simpler to operate if you are already running Postgres. Best suited for datasets under 1 million vectors.",
    "source": "live-demo"
  }'
```

Then immediately search for it in the UI:

> Type: `postgres extension for embeddings`

> "That document was embedded and inserted in real time. The ingest route called OpenAI
> to produce a 1536-dimension vector, stored it in Weaviate, and it's immediately
> searchable — no reindexing required."

---

## Step 6 — Architecture Summary (1 minute)

Draw or reference this diagram:

```
Browser → Next.js API routes (Vercel)
                ↓
          OpenAI API  ← converts text to 1536-dim vectors
                ↓
          Weaviate (Railway) ← stores documents + HNSW vector index
```

> "Three components. Next.js handles the API and UI — stateless, runs on Vercel.
> OpenAI provides the embedding model that converts any text into a vector.
> Weaviate is the only stateful piece — it owns both the raw document data and the
> HNSW graph index that makes similarity search fast. Total infrastructure cost
> is under $3/month."

---

## Common Questions

**Why not use a keyword search like Elasticsearch?**
Keyword search matches exact terms — it has no concept of meaning. A query for "vehicle" won't match a document about "cars". Vector search finds semantic neighbors regardless of vocabulary.

**Why Weaviate over Pinecone or pgvector?**
Weaviate runs as a single Docker container with no vendor lock-in, supports hybrid search out of the box, and fits within Railway's low-cost tier. Pinecone is managed (easier ops) but costs more. pgvector is a good fit if you're already on Postgres and don't need scale — it does exact search, which becomes slow past ~1M vectors.

**What happens at 10 million vectors?**
The HNSW index no longer fits in RAM. You'd need Weaviate's distributed mode or a purpose-built service like Milvus. Ingestion would also need async pipelining to keep up with embedding throughput.

**Is this production-ready?**
The architecture is sound — proper batching, no hardcoded secrets, schema validation. What's missing for production: authentication on the Weaviate instance, rate limiting on the API routes, error monitoring, and a UUID store to prevent duplicate ingestion.
