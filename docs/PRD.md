# Product Requirements Document — Cortex Store

**Version:** 1.1  
**Date:** 2026-06-19  
**Status:** Shipped

---

## Problem

Keyword search fails for natural language queries. A document about "automobiles" won't surface when a user searches "car". Traditional search engines match exact terms — they have no concept of meaning.

## Solution

Cortex Store is a semantic document search engine. It converts both documents and queries into high-dimensional vectors using an embedding model, then finds documents by vector proximity rather than term overlap. Documents with similar meaning score highly even when they share no words. A hybrid mode blends vector similarity with keyword matching for queries that benefit from both.

---

## Users

Developers building search features who want to understand and experiment with vector search end-to-end — from ingestion through retrieval — using a minimal, self-contained implementation.

---

## Goals

- Demonstrate semantic and hybrid search over a small corpus of documents
- Provide a secure REST API for document ingestion and querying
- Keep infrastructure cost under $5/month
- Be deployable by a single developer in under 30 minutes

## Non-Goals

- User authentication or multi-tenancy
- Supporting datasets larger than ~10,000 vectors
- Fine-tuning or training custom embedding models
- Real-time document sync from external sources

---

## Functional Requirements

| # | Requirement |
|---|---|
| FR-1 | Users can submit a natural language query and receive ranked results |
| FR-2 | Results display title, content excerpt, source, and similarity score |
| FR-3 | Users can toggle between semantic and hybrid (semantic + BM25) search modes |
| FR-4 | Documents can be ingested one at a time via authenticated REST API |
| FR-5 | Documents can be ingested in bulk via a seed script |
| FR-6 | Seed script skips ingestion if documents already exist |
| FR-7 | Results with similarity below a configurable threshold are excluded |
| FR-8 | Schema initializes automatically on first ingest if not already present |
| FR-9 | Total indexed document count is displayed in the UI |
| FR-10 | Documents can be deleted by UUID via authenticated REST API |

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | Search round-trip (embed + ANN query) completes in under 500ms |
| NFR-2 | Embedding API key and Weaviate API key are never exposed to the client |
| NFR-3 | Infrastructure cost stays under $5/month at ≤1,000 documents |
| NFR-4 | No secrets are committed to the repository |
| NFR-5 | `/api/search` is rate limited to 20 requests/minute per IP |
| NFR-6 | `/api/ingest` is rate limited to 5 requests/minute per IP and requires a bearer token |
| NFR-7 | Unhandled errors are captured and reported to Sentry |

---

## User Flow

### Search
```
User enters query + selects mode (semantic / hybrid)
      ↓
Frontend sends GET /api/search?q=...&mode=...
      ↓
API route checks rate limit → embeds query via OpenAI
      ↓
Weaviate returns top-k nearest documents
      ↓
Results displayed with similarity scores and mode badge
```

### Ingest
```
Caller sends POST /api/ingest with Bearer token
      ↓
API route validates token → checks rate limit
      ↓
Embeds title + content → stores vector in Weaviate
      ↓
Returns document UUID
```

---

## Constraints

- Weaviate must be self-hosted (Railway) to stay within the free/low-cost tier
- OpenAI `text-embedding-3-small` is used to keep embedding cost minimal ($0.02/1M tokens)
- Vercel serverless functions have a 10s timeout — embedding + search must complete within that window
- Rate limiting requires Upstash Redis (free tier: 10K commands/day)

---

## Success Criteria

- A query containing none of the exact words in a document still surfaces that document when semantically related
- Hybrid mode surfaces results for exact-term queries that vector search would miss
- Ingesting a new document makes it immediately searchable without reindexing
- Unauthenticated requests to `/api/ingest` return 401
- Requests exceeding rate limits return 429
- Errors appear in the Sentry dashboard within seconds of occurring
- The app deploys to Vercel and Railway with only environment variable configuration
