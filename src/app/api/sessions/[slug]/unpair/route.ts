import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { Session } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { player_id: number };

    if (!body.player_id) {
      return NextResponse.json({ error: "player_id required" }, { status: 400 });
    }

    const db = await getDB();

    const session = await db
      .prepare("SELECT * FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<Session>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await db
      .prepare(
        `UPDATE players SET partner_id = NULL
         WHERE session_id = ? AND (id = ? OR partner_id = ?)`
      )
      .bind(session.id, body.player_id, body.player_id)
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
