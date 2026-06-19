"use client";

import { useState, useEffect } from "react";

interface Result {
  title: string;
  content: string;
  source: string;
  // semantic mode
  certainty?: number;
  distance?: number;
  // hybrid mode
  _additional?: { score: string };
}

type Mode = "semantic" | "hybrid";

export default function Home() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("semantic");
  const [docCount, setDocCount] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch("/api/count")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setDocCount(d.count); });
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setSearched(false);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&mode=${mode}`
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setResults(data.results);
      setSearched(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function scoreLabel(r: Result): string | null {
    if (mode === "semantic" && r.certainty != null) {
      return `${(r.certainty * 100).toFixed(1)}%`;
    }
    if (mode === "hybrid" && r._additional?.score != null) {
      return `score ${parseFloat(r._additional.score).toFixed(3)}`;
    }
    return null;
  }

  function scoreBadgeColor(r: Result): string {
    if (mode === "semantic" && r.certainty != null) {
      if (r.certainty >= 0.85) return "text-green-600 bg-green-50";
      if (r.certainty >= 0.70) return "text-yellow-700 bg-yellow-50";
      return "text-orange-600 bg-orange-50";
    }
    return "text-blue-600 bg-blue-50";
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Cortex Store
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Semantic document search · Weaviate + OpenAI embeddings
            {docCount !== null && (
              <span className="ml-2 text-gray-400">· {docCount} documents indexed</span>
            )}
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={search} className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. how does approximate nearest neighbor search work?"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-8">
          {(["semantic", "hybrid"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-300 text-gray-500 hover:border-gray-400"
              }`}
            >
              {m === "semantic" ? "Semantic" : "Hybrid (semantic + keyword)"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        {/* Empty state */}
        {searched && results.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">
            No results found. Try rephrasing your query.
          </p>
        )}

        {/* Results */}
        <div className="space-y-4">
          {results.map((r, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm"
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <h2 className="font-semibold text-gray-900 text-sm leading-snug">
                  {r.title}
                </h2>
                {scoreLabel(r) && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${scoreBadgeColor(r)}`}
                  >
                    {scoreLabel(r)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                {r.content}
              </p>
              {r.source && (
                <p className="text-xs text-gray-400 mt-3 font-mono">{r.source}</p>
              )}
            </div>
          ))}
        </div>

        {/* Hint */}
        {!searched && !loading && (
          <div className="mt-12 text-center text-xs text-gray-400 space-y-1">
            <p>Try: &ldquo;what is HNSW&rdquo; · &ldquo;cosine vs euclidean&rdquo; · &ldquo;RAG pattern&rdquo;</p>
          </div>
        )}
      </div>
    </main>
  );
}
