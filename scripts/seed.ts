// Run: npx tsx scripts/seed.ts
// Reads WEAVIATE_URL and OPENAI_API_KEY from .env.local

import { config } from "dotenv";
config({ path: ".env.local" });

import { initSchema, batchAddDocuments } from "../lib/weaviate";
import { embedBatch } from "../lib/embeddings";

const SAMPLE_DOCS = [
  {
    title: "What is a Vector Database?",
    content:
      "A vector database stores high-dimensional vectors and enables fast similarity search using approximate nearest-neighbor (ANN) algorithms like HNSW. Unlike traditional databases that match exact values, vector databases find semantically similar content.",
    source: "docs/intro",
  },
  {
    title: "HNSW Index Explained",
    content:
      "Hierarchical Navigable Small World (HNSW) is a graph-based ANN algorithm. It builds a multi-layer graph where each layer is a subset of the previous one. Queries start at the top layer (coarse) and navigate down to the bottom (fine), giving O(log n) average query time.",
    source: "docs/algorithms",
  },
  {
    title: "Cosine vs Euclidean Distance",
    content:
      "Cosine similarity measures the angle between two vectors (direction only, ignoring magnitude). Euclidean distance measures the straight-line distance. For text embeddings, cosine similarity is preferred because the magnitude of an embedding vector carries less semantic meaning than its direction.",
    source: "docs/metrics",
  },
  {
    title: "OpenAI Embedding Models",
    content:
      "text-embedding-3-small produces 1536-dimensional vectors at $0.02/1M tokens. text-embedding-3-large produces 3072-dimensional vectors at $0.13/1M tokens. For most retrieval tasks, 3-small provides excellent quality at a fraction of the cost.",
    source: "docs/openai",
  },
  {
    title: "RAG Architecture Pattern",
    content:
      "Retrieval-Augmented Generation (RAG) combines a vector database with an LLM. The query is embedded and used to retrieve relevant context from the vector DB. That context is then injected into the LLM prompt, grounding its response in real data.",
    source: "docs/patterns",
  },
  {
    title: "Weaviate Schema Design",
    content:
      "Weaviate organizes data into classes (collections). Each class has properties (structured fields) and a vector. Setting vectorizer: none means you supply the vector yourself, giving you full control over the embedding model and preprocessing.",
    source: "docs/weaviate",
  },
  {
    title: "Approximate Nearest Neighbor Search",
    content:
      "ANN algorithms trade a small amount of accuracy for massive speed gains over exact nearest-neighbor search. In practice, top-10 recall rates above 95% are achievable with HNSW while being orders of magnitude faster than brute-force for large datasets.",
    source: "docs/algorithms",
  },
  {
    title: "Vector Dimensions and Memory",
    content:
      "Each vector dimension is stored as a 32-bit float (4 bytes). A 1536-dimension vector uses ~6KB. 1000 vectors = ~6MB of raw vector data. The HNSW graph structure adds overhead: roughly 2-3x the raw vector size, so 1000 vectors at 1536 dims ≈ 18MB total.",
    source: "docs/memory",
  },
  {
    title: "Semantic Search vs Keyword Search",
    content:
      "Keyword search matches exact terms using inverted indexes (BM25, TF-IDF). Semantic search matches meaning using vector similarity. A keyword search for 'automobile' won't find documents about 'cars'. A semantic search will, because both words are close in embedding space.",
    source: "docs/concepts",
  },
  {
    title: "Batch Ingestion Best Practices",
    content:
      "Always use batch APIs when ingesting multiple documents. Single-document inserts have network round-trip overhead per document. Weaviate's batch API accepts up to 1000 objects per request. OpenAI's embeddings API accepts up to 2048 inputs per call.",
    source: "docs/ingestion",
  },
];

async function main() {
  console.log("Initializing schema...");
  const schemaResult = await initSchema();
  console.log("Schema:", schemaResult.status ?? "created");

  const texts = SAMPLE_DOCS.map((d) => `${d.title}\n\n${d.content}`);
  console.log(`\nEmbedding ${texts.length} documents (single API call)...`);
  const vectors = await embedBatch(texts);
  console.log(`Got ${vectors.length} vectors, each ${vectors[0].length} dims.`);

  const docs = SAMPLE_DOCS.map((d, i) => ({ ...d, vector: vectors[i] }));

  console.log("\nUploading to Weaviate...");
  const result = await batchAddDocuments(docs);

  const errors = result.filter((r: any) => r.result?.errors);
  if (errors.length > 0) {
    console.error("Errors:", JSON.stringify(errors, null, 2));
    process.exit(1);
  }

  console.log(`\nDone. Inserted ${docs.length} documents.`);
  console.log("\nTry searching:");
  console.log('  curl "http://localhost:3000/api/search?q=how+does+HNSW+work"');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
