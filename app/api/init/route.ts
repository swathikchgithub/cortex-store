import { initSchema } from "@/lib/weaviate";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const result = await initSchema();
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
