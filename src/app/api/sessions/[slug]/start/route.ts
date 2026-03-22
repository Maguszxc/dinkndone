import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { fillEmptyCourts } from "@/lib/rotation";
import type { Session } from "@/types";


export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = await getDB();

    const session = await db
      .prepare("SELECT * FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<Session>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Activate session and set last_match_at to now
    await db
      .prepare("UPDATE sessions SET is_active = 1, last_match_at = unixepoch() WHERE id = ?")
      .bind(session.id)
      .run();

    const activeSession = { ...session, is_active: 1 };

    // Fill all courts from queue
    await fillEmptyCourts(db, activeSession);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
