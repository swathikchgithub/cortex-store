# Product Requirements Document — Cortex Store

**Version:** 1.0  
**Date:** 2026-06-18  
**Status:** Shipped

---

## Problem

Keyword search fails for natural language queries. A document about "automobiles" won't surface when a user searches "car". Traditional search engines match exact terms — they have no concept of meaning.

## Solution

Cortex Store is a semantic document search engine. It converts both documents and queries into high-dimensional vectors using an embedding model, then finds documents by vector proximity rather than term overlap. Documents with similar meaning score highly even when they share no words.

---

## Users

Developers building search features who want to understand and experiment with vector search end-to-end — from ingestion through retrieval — using a minimal, self-contained implementation.

---

## Goals

- Demonstrate semantic search over a small corpus of documents
- Provide a REST API for document ingestion and querying
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
| FR-3 | Documents can be ingested one at a time via REST API |
| FR-4 | Documents can be ingested in bulk via a seed script |
| FR-5 | Results with similarity below a configurable threshold are excluded |
| FR-6 | Hybrid search (vector + keyword) is available as an API option |
| FR-7 | Schema initializes automatically on first ingest if not already present |

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | Search round-trip (embed + ANN query) completes in under 500ms |
| NFR-2 | Embedding API key is never exposed to the client |
| NFR-3 | Infrastructure cost stays under $5/month at ≤1,000 documents |
| NFR-4 | No secrets are committed to the repository |

---

## User Flow

```
User enters query
      ↓
Frontend sends GET /api/search?q=...
      ↓
API route embeds query via OpenAI
      ↓
Weaviate returns top-k nearest documents
      ↓
Results displayed with similarity scores
```

---

## Constraints

- Weaviate must be self-hosted (Railway) to stay within the free/low-cost tier
- OpenAI `text-embedding-3-small` is used to keep embedding cost minimal ($0.02/1M tokens)
- Vercel serverless functions have a 10s timeout — embedding + search must complete within that window

---

## Success Criteria

- A query containing none of the exact words in a document still surfaces that document when semantically related
- Ingesting a new document makes it immediately searchable without reindexing
- The app deploys to Vercel and Railway with only environment variable configuration
