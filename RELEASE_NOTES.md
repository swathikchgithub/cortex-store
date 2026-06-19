# Release Notes

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
