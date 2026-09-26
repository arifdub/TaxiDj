import { NextResponse } from "next/server";
import { countClick } from "@/lib/radio/service";

// POST /api/radio/click { id } — counts a play on Radio Browser, as their
// API guidelines ask clients to do.
export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (typeof id === "string") await countClick(id);
  return NextResponse.json({ ok: true });
}
