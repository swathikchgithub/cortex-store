import { addDocument } from "@/lib/weaviate";
import { embed } from "@/lib/embeddings";
import { ingestLimiter } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token !== process.env.INGEST_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await ingestLimiter.limit(ip);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait and try again." },
      { status: 429 }
    );
  }

  try {
    const { title, content, source } = await req.json();

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: "title and content are required" },
        { status: 400 }
      );
    }

    // Embed title + content together so search matches on either
    const vector = await embed(`${title}\n\n${content}`);
    const doc = await addDocument({ title, content, source, vector });

    return NextResponse.json({ ok: true, id: doc.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
