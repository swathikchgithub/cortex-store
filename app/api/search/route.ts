import { searchDocuments, hybridSearch } from "@/lib/weaviate";
import { embed } from "@/lib/embeddings";
import { searchLimiter } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await searchLimiter.limit(ip);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait and try again." },
      { status: 429 }
    );
  }

  try {
    const q = req.nextUrl.searchParams.get("q");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "5");
    const mode = req.nextUrl.searchParams.get("mode") ?? "semantic";

    if (!q) {
      return NextResponse.json(
        { ok: false, error: "q is required" },
        { status: 400 }
      );
    }

    const vector = await embed(q);

    if (mode === "hybrid") {
      const results = await hybridSearch(q, vector, Math.min(limit, 20));
      return NextResponse.json({ ok: true, results, query: q, mode });
    }

    const results = await searchDocuments(vector, Math.min(limit, 20));
    return NextResponse.json({ ok: true, results, query: q, mode });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
