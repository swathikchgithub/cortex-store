# Cortex Store

Semantic document search built with Next.js, Weaviate, and OpenAI embeddings. Finds documents by meaning, not keyword matching.

## What it does

- Converts text into 1536-dimension vectors using OpenAI `text-embedding-3-small`
- Stores and indexes vectors in Weaviate using HNSW for fast approximate nearest neighbor search
- Supports semantic search, hybrid search (vector + BM25), and cosine similarity scoring
- Provides a REST API for ingesting and querying documents

## Stack

| Layer | Technology |
|---|---|
| Frontend / API | Next.js 16 (App Router) |
| Vector database | Weaviate (Docker / Railway) |
| Embedding model | OpenAI `text-embedding-3-small` |
| Styling | Tailwind CSS v4 |

## Prerequisites

- Node.js 20+
- Docker (for local Weaviate)
- OpenAI API key

## Local setup

**1. Clone and install**

```bash
git clone <repo-url>
cd cortex-store
npm install
```

**2. Set environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
OPENAI_API_KEY=your_openai_api_key
WEAVIATE_URL=http://localhost:8080
```

**3. Start Weaviate**

```bash
docker-compose up -d
```

**4. Initialize the schema and seed documents**

```bash
npx tsx scripts/seed.ts
```

**5. Run the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

### `POST /api/ingest`

Add a document to the vector index.

```json
{
  "title": "Document title",
  "content": "Document body text",
  "source": "optional-source-label"
}
```

### `GET /api/search?q=your+query&limit=5`

Search for documents by semantic similarity. Returns results ranked by cosine certainty.

### `POST /api/init`

Initialize the Weaviate schema (called automatically by the seed script).

## Docs

| Document | Description |
|---|---|
| [docs/PRD.md](./docs/PRD.md) | Product requirements — goals, user flows, success criteria |
| [docs/TDD.md](./docs/TDD.md) | Technical design — architecture, components, data model |
| [docs/DEMO.md](./docs/DEMO.md) | Step-by-step demo walkthrough |

## Deployment

See [RELEASE_NOTES.md](./RELEASE_NOTES.md) for version history.

For Vercel deployment, set the following environment variables in the Vercel dashboard:

- `OPENAI_API_KEY`
- `WEAVIATE_URL` (your Railway or hosted Weaviate instance URL)

## License

MIT — see [LICENSE](./LICENSE).
