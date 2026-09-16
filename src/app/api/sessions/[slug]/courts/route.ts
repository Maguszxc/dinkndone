import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = await getDB();

    const session = await db
      .prepare("SELECT id FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<{ id: number }>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const maxCourt = await db
      .prepare("SELECT COALESCE(MAX(court_number), 0) AS max_court FROM courts WHERE session_id = ?")
      .bind(session.id)
      .first<{ max_court: number }>();

    const nextCourt = (maxCourt?.max_court ?? 0) + 1;

    await db
      .prepare("INSERT INTO courts (session_id, court_number, status) VALUES (?, ?, 'active')")
      .bind(session.id, nextCourt)
      .run();

    await db
      .prepare("UPDATE sessions SET num_courts = ? WHERE id = ?")
      .bind(nextCourt, session.id)
      .run();

    return NextResponse.json({ ok: true, court_number: nextCourt });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
