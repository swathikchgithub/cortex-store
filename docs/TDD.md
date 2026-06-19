# Technical Design Document — Cortex Store

**Version:** 1.0  
**Date:** 2026-06-18  
**Status:** Implemented

---

## Architecture Overview

```
Browser
  └── Next.js App Router (Vercel)
        ├── GET  /api/search   → embed query → Weaviate ANN search
        ├── POST /api/ingest   → embed document → Weaviate insert
        └── POST /api/init     → Weaviate schema init

Weaviate (Railway Docker)
  └── Document class
        ├── Properties: title, content, source
        └── Vector index: HNSW

OpenAI API
  └── text-embedding-3-small (1536 dimensions)
```

---

## Components

### `lib/embeddings.ts`

Wraps the OpenAI embeddings API.

**`embed(text)`** — single text → 1536-dimension vector. Used by the search and ingest routes.

**`embedBatch(texts[])`** — array of texts → array of vectors in a single API call. Used by the seed script for bulk ingestion. Reduces N API calls to 1 — same token cost, ~10x lower latency.

**Lazy client init:** The OpenAI client is constructed inside the function, not at module load time. Next.js evaluates route modules at build time to collect metadata; constructing the client at load time would throw because `OPENAI_API_KEY` is not available during the build. Lazy init defers construction until the first actual request.

---

### `lib/weaviate.ts`

All Weaviate communication over REST. The Weaviate TypeScript client v3 uses gRPC by default, which Railway's HTTP proxy does not support. Direct REST calls are used instead — simpler to debug and portable across any HTTP host.

**Schema (`initSchema`):**

```typescript
vectorIndexConfig: {
  ef: 64,             // search beam width
  efConstruction: 128, // index build quality
  maxConnections: 16,  // graph edges per node
}
```

`vectorizer: "none"` — Weaviate does not call any embedding API. Vectors are supplied by the application, giving full control over model selection and preprocessing.

`maxConnections: 16` (down from the default of 64) reduces graph memory by ~75%, appropriate for a dataset under 1,000 vectors.

**`searchDocuments(vector, limit, certaintyThreshold)`:**

Uses `nearVector` GraphQL query. `certaintyThreshold: 0.6` maps to cosine similarity ≥ 0.2 (`certainty = (cosine + 1) / 2`). Results below the threshold are excluded rather than returned with low scores.

**`hybridSearch(query, vector, limit)`:**

Uses Weaviate's `hybrid` operator with `alpha: 0.5` — equal weight to BM25 keyword matching and vector similarity. Useful when queries include specific identifiers (product codes, proper nouns) that vector search can miss.

---

### API Routes

**`POST /api/ingest`**

1. Validates `title` and `content` fields
2. Embeds `"${title}\n\n${content}"` as a single string — so the vector captures both title and body semantics
3. Calls `addDocument` to store in Weaviate

**`GET /api/search?q=&limit=`**

1. Embeds the query string using the same model as ingestion (critical — mismatched models produce vectors in incompatible spaces)
2. Calls `searchDocuments` with `limit` capped at 20
3. Returns ranked results with `certainty` and `distance`

**`POST /api/init`**

Calls `initSchema`. Idempotent — returns `already_exists` if the schema is present. Safe to call on every deploy.

---

## Data Model

**Weaviate `Document` class:**

| Property | Type | Notes |
|---|---|---|
| title | text | Indexed for BM25 hybrid search |
| content | text | Indexed for BM25 hybrid search |
| source | text | Label for origin (e.g. "seed", "live-demo") |
| vector | float[] | 1536-dim, supplied externally, indexed by HNSW |

Each object gets a UUID assigned by Weaviate on insert. To update a document's vector, re-embed and PATCH the object by UUID.

---

## Similarity Scoring

Weaviate uses cosine similarity internally and exposes two values:

- **`certainty`** — `(cosine_similarity + 1) / 2`, normalized to [0, 1]. Used for display.
- **`distance`** — `1 - cosine_similarity`. Lower is more similar.

Cosine similarity is preferred over Euclidean distance for text embeddings because it is magnitude-invariant — a longer paraphrase of the same sentence produces a vector of different length but the same direction, so it scores identically to the original.

---

## HNSW Index

HNSW (Hierarchical Navigable Small World) builds a multi-layer graph:

```
Layer 2 (sparse):  A ────────── E               (few nodes, long jumps)
Layer 1:           A ── B ── D ── E ── F
Layer 0 (dense):   A─B─C─D─E─F─G─H─I─J─K        (all nodes)
```

Search starts at the top layer (coarse), descends to finer layers, and does a local exhaustive search at layer 0. Average query time: O(log n). The trade-off is approximate recall — in practice >95% recall at the configured `ef: 64`.

---

## Embedding Strategy

Documents are embedded as `"${title}\n\n${content}"` — a single concatenated string. This ensures:

- A query matching the title verbatim finds the document
- A query about a concept in the body also finds the document
- One vector per document keeps the index simple

The same model (`text-embedding-3-small`) is used for both ingestion and querying. Using different models would place query and document vectors in incompatible spaces, making similarity scores meaningless.

---

## Cost Model

| Component | Cost |
|---|---|
| Weaviate on Railway (256MB RAM) | ~$2.80/month |
| Vercel (Next.js) | Free tier |
| OpenAI embeddings (1,000 docs × 500 tokens avg) | ~$0.01 one-time |
| OpenAI embeddings (1,000 queries/month × 20 tokens) | ~$0.0004/month |
| **Total** | **~$2.81/month** |

---

## Deployment

```
Local dev:   docker-compose up -d (Weaviate) + npm run dev (Next.js)
Production:  Weaviate on Railway, Next.js on Vercel
Secrets:     OPENAI_API_KEY, WEAVIATE_URL — set in Vercel dashboard, never committed
```

Post-deploy checklist:
1. Set `OPENAI_API_KEY` and `WEAVIATE_URL` in Vercel environment variables
2. Hit `POST /api/init` once to initialize the Weaviate schema
3. Run `npx tsx scripts/seed.ts` against the production `WEAVIATE_URL` to load initial documents

---

## Known Limitations

- No authentication on the Weaviate instance (anonymous access)
- No rate limiting on API routes
- No UUID store — re-running the seed script creates duplicate documents
- HNSW index is in-memory — not suitable past ~100,000 vectors on the Railway free tier
