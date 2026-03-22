import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { triggerRotation, fillEmptyCourts } from "@/lib/rotation";
import type { Match, Session } from "@/types";


export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as {
      match_id: number;
      winner_team: "a" | "b" | null;
    };

    const db = await getDB();

    const session = await db
      .prepare("SELECT * FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<Session>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const match = await db
      .prepare("SELECT * FROM matches WHERE id = ? AND session_id = ? AND is_active = 1")
      .bind(body.match_id, session.id)
      .first<Match>();

    if (!match) {
      return NextResponse.json({ error: "Active match not found" }, { status: 404 });
    }

    // Close the match
    await db
      .prepare(
        `UPDATE matches SET is_active = 0, ended_at = datetime('now'), winner_team = ?
         WHERE id = ?`
      )
      .bind(body.winner_team ?? null, match.id)
      .run();

    const closedMatch = { ...match, is_active: 0, winner_team: body.winner_team ?? null };

    // Trigger rotation for this court, then fill any other empty courts
    await triggerRotation(db, session, closedMatch, body.winner_team ?? null);
    await fillEmptyCourts(db, session);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
