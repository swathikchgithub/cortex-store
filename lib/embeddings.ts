import OpenAI from "openai";

// Lazy init: client is created at call time, not module load time.
// This prevents build failures when OPENAI_API_KEY isn't set at build time.
function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// text-embedding-3-small: $0.02/1M tokens, 1536 dims — 5x cheaper than ada-002
export async function embed(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

// Single API call for up to 2048 inputs — use for bulk ingestion
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.slice(0, 8000)),
  });
  // OpenAI guarantees results are in the same order as input
  return res.data.map((d) => d.embedding);
}
