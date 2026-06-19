# Release Notes

## v0.1.3 — 2026-06-19

### Security
- Protected `POST /api/ingest` with bearer token auth — requires `INGEST_SECRET` header, returns 401 without it

---

## v0.1.2 — 2026-06-19

### Features
- Hybrid search toggle in UI — blends vector similarity and BM25 keyword matching (alpha: 0.5)
- Search mode selector pill buttons (Semantic / Hybrid) with per-mode score badges
- `mode` query param added to `GET /api/search` — accepts `semantic` (default) or `hybrid`

### Security
- Rate limiting on `/api/search` (20 req/min) and `/api/ingest` (5 req/min) via Upstash Redis

---

## v0.1.1 — 2026-06-19

### Security
- Locked down Weaviate with API key authentication — anonymous access disabled
- `WEAVIATE_API_KEY` required on all server-side requests to Weaviate

---

## v0.1.0 — 2026-06-18

Initial release.

### Features
- Semantic document search via OpenAI `text-embedding-3-small` embeddings
- Weaviate HNSW vector index with configurable `ef`, `efConstruction`, and `maxConnections`
- Hybrid search blending vector similarity and BM25 keyword matching
- REST API: `POST /api/ingest`, `GET /api/search`, `POST /api/init`
- Cosine certainty scoring with configurable threshold (default 0.6)
- Batch embedding ingestion — single OpenAI API call per batch
- Seed script for bulk document ingestion (`scripts/seed.ts`)
- Next.js App Router frontend with Tailwind CSS v4
- Docker Compose setup for local Weaviate instance
