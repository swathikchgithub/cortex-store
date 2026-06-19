import { addDocument } from "@/lib/weaviate";
import { embed } from "@/lib/embeddings";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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
