# Technical Design Document — Cortex Store

**Version:** 1.1  
**Date:** 2026-06-19  
**Status:** Implemented

---

## Architecture Overview

```
Browser
  └── Next.js App Router (Vercel)
        ├── GET    /api/search          → rate limit → embed → Weaviate search
        ├── POST   /api/ingest          → auth → rate limit → embed → Weaviate insert
        ├── DELETE /api/documents/:id   → auth → Weaviate delete
        ├── GET    /api/count           → Weaviate aggregate count
        └── POST   /api/init            → Weaviate schema init

Weaviate (Railway Docker)             ← API key auth required
  └── Document class
        ├── Properties: title, content, source
        └── Vector index: HNSW

OpenAI API
  └── text-embedding-3-small (1536 dimensions)

Upstash Redis
  └── Sliding window rate limiter (per IP)

Sentry
  └── Error monitoring + performance tracing
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

Every request sends `Authorization: Bearer ${WEAVIATE_API_KEY}` — Weaviate rejects unauthenticated requests with 401.

**Schema (`initSchema`):**

```typescript
vectorIndexConfig: {
  ef: 64,              // search beam width
  efConstruction: 128, // index build quality
  maxConnections: 16,  // graph edges per node
}
```

`vectorizer: "none"` — Weaviate does not call any embedding API. Vectors are supplied by the application.

`maxConnections: 16` (down from the default of 64) reduces graph memory by ~75%, appropriate for a dataset under 1,000 vectors.

**`searchDocuments(vector, limit, certaintyThreshold)`:**

Uses `nearVector` GraphQL query. `certaintyThreshold: 0.6` maps to cosine similarity ≥ 0.2. Results below the threshold are excluded.

**`hybridSearch(query, vector, limit)`:**

Uses Weaviate's `hybrid` operator with `alpha: 0.5` — equal weight to BM25 keyword matching and vector similarity.

**`getDocumentCount()`:**

GraphQL `Aggregate` query — returns total document count. Used by `/api/count` and the seed script duplicate check.

**`deleteDocument(id)`:**

`DELETE /v1/objects/Document/:id` — removes a document by UUID. 404 is treated as success (idempotent).

**`getDocumentIds()`:**

Lists all document UUIDs. Available for admin tooling.

---

### `lib/ratelimit.ts`

Wraps `@upstash/ratelimit` with two sliding window limiters backed by Upstash Redis:

- **`searchLimiter`** — 20 requests per 60 seconds per IP (`prefix: "rl:search"`)
- **`ingestLimiter`** — 5 requests per 60 seconds per IP (`prefix: "rl:ingest"`)

IP is read from `x-forwarded-for` header, falling back to `"anonymous"`.

---

### API Routes

**`GET /api/search?q=&limit=&mode=`**

1. Checks rate limit via `searchLimiter` — returns 429 if exceeded
2. Embeds query using the same model as ingestion
3. If `mode=hybrid`: calls `hybridSearch`, returns results with `_additional.score`
4. If `mode=semantic` (default): calls `searchDocuments`, returns results with `certainty` and `distance`

**`POST /api/ingest`**

1. Validates `Authorization: Bearer` header against `INGEST_SECRET` — returns 401 if missing or wrong
2. Checks rate limit via `ingestLimiter` — returns 429 if exceeded
3. Validates `title` and `content` fields
4. Embeds `"${title}\n\n${content}"` — single vector captures both title and body semantics
5. Stores document in Weaviate, returns UUID

**`DELETE /api/documents/:id`**

1. Validates `Authorization: Bearer` header against `INGEST_SECRET` — returns 401 if wrong
2. Deletes document by UUID from Weaviate

**`GET /api/count`**

Returns total number of indexed documents. Called on page load to populate the UI header count.

**`POST /api/init`**

Calls `initSchema`. Idempotent — returns `already_exists` if schema is present.

---

### Sentry Integration

`@sentry/nextjs` is initialized in three config files:

- `sentry.server.config.ts` — server-side (API routes, SSR)
- `sentry.edge.config.ts` — edge runtime
- `instrumentation-client.ts` — browser

`app/global-error.tsx` catches unhandled React errors and reports them.

`tracesSampleRate: 0.1` — 10% of requests are traced. Appropriate for a low-traffic portfolio project.

`next.config.ts` wraps the Next.js config with `withSentryConfig` for source map uploads and automatic instrumentation.

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

**Semantic mode:**
- **`certainty`** — `(cosine_similarity + 1) / 2`, normalized to [0, 1]. Displayed as a percentage with color coding: green ≥85%, yellow ≥70%, orange below.
- **`distance`** — `1 - cosine_similarity`. Lower is more similar.

**Hybrid mode:**
- **`_additional.score`** — Weaviate's internal fusion score blending BM25 and vector similarity. Displayed as a raw decimal.

---

## HNSW Index

HNSW (Hierarchical Navigable Small World) builds a multi-layer graph:

```
Layer 2 (sparse):  A ────────── E               (few nodes, long jumps)
Layer 1:           A ── B ── D ── E ── F
Layer 0 (dense):   A─B─C─D─E─F─G─H─I─J─K        (all nodes)
```

Average query time: O(log n). Trade-off is approximate recall — in practice >95% recall at `ef: 64`.

---

## Embedding Strategy

Documents are embedded as `"${title}\n\n${content}"` — a single concatenated string so one vector captures both title and body semantics. The same model (`text-embedding-3-small`) is used for both ingestion and querying — mismatched models would place vectors in incompatible spaces.

---

## Security

| Layer | Control |
|---|---|
| Weaviate | API key auth — anonymous access disabled |
| `/api/ingest` | Bearer token (`INGEST_SECRET`) checked before processing |
| `/api/documents/:id` | Same `INGEST_SECRET` required |
| `/api/search` | Rate limited — 20 req/min per IP |
| `/api/ingest` | Rate limited — 5 req/min per IP |
| Secrets | Never committed — `.env.local` and `.env.sentry-build-plugin` are gitignored |

---

## Cost Model

| Component | Cost |
|---|---|
| Weaviate on Railway (256MB RAM) | ~$2.80/month |
| Vercel (Next.js) | Free tier |
| Upstash Redis | Free tier (10K commands/day) |
| Sentry | Free tier (5K errors/month) |
| OpenAI embeddings (1,000 docs × 500 tokens avg) | ~$0.01 one-time |
| OpenAI embeddings (1,000 queries/month × 20 tokens) | ~$0.0004/month |
| **Total** | **~$2.81/month** |

---

## Deployment

```
Local dev:   docker-compose up -d (Weaviate) + npm run dev (Next.js)
Production:  Weaviate on Railway, Next.js on Vercel, Redis on Upstash
```

**Required environment variables:**

| Variable | Where |
|---|---|
| `OPENAI_API_KEY` | Vercel + `.env.local` |
| `WEAVIATE_URL` | Vercel + `.env.local` |
| `WEAVIATE_API_KEY` | Vercel + `.env.local` + Railway |
| `UPSTASH_REDIS_REST_URL` | Vercel + `.env.local` |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel + `.env.local` |
| `INGEST_SECRET` | Vercel + `.env.local` |
| `SENTRY_AUTH_TOKEN` | Vercel + `.env.sentry-build-plugin` |

**Post-deploy checklist:**
1. Set all environment variables in Vercel dashboard
2. Set `WEAVIATE_API_KEY` in Railway Weaviate service
3. Hit `POST /api/init` once to initialize the Weaviate schema
4. Run `npx tsx scripts/seed.ts` to load initial documents (skips automatically if already seeded)

---

## Known Limitations

- HNSW index is in-memory — not suitable past ~100,000 vectors on the Railway free tier
- No UUID store for ingested documents — updates require knowing the Weaviate-assigned UUID
- No user-facing document management UI — delete requires direct API call with bearer token
