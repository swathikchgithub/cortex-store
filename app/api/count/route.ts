import { getDocumentCount } from "@/lib/weaviate";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const count = await getDocumentCount();
    return NextResponse.json({ ok: true, count });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
