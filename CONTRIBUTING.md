# Contributing to Cortex Store

## Prerequisites

- Node.js 20+
- Docker (for local Weaviate)
- An OpenAI API key

## Local setup

```bash
git clone https://github.com/swathikchpro/cortex-store.git
cd cortex-store
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=localkey
OPENAI_API_KEY=your_openai_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
INGEST_SECRET=any_local_secret
```

Start Weaviate:

```bash
docker-compose up -d
```

Seed documents and run the dev server:

```bash
npx tsx scripts/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Making changes

- Keep changes focused — one feature or fix per PR
- Run `npm run lint` before opening a PR
- API routes live in `app/api/` — add a new folder per endpoint
- Weaviate logic lives in `lib/weaviate.ts`
- Embedding logic lives in `lib/embeddings.ts`

## Opening a pull request

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Push and open a PR against `main`
4. Describe what you changed and why in the PR description
