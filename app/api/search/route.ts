import { searchDocuments } from "@/lib/weaviate";
import { embed } from "@/lib/embeddings";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "5");

    if (!q) {
      return NextResponse.json(
        { ok: false, error: "q is required" },
        { status: 400 }
      );
    }

    const vector = await embed(q);
    const results = await searchDocuments(vector, Math.min(limit, 20));

    return NextResponse.json({ ok: true, results, query: q });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
