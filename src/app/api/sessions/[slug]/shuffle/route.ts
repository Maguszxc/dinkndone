import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { fillEmptyCourts } from "@/lib/rotation";
import type { Player, Session } from "@/types";

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

    // Only allow shuffle when no active matches are running
    const activeMatch = await db
      .prepare("SELECT id FROM matches WHERE session_id = ? AND is_active = 1")
      .bind(session.id)
      .first<{ id: number }>();

    if (activeMatch) {
      return NextResponse.json(
        { error: "Cannot shuffle while matches are in progress" },
        { status: 400 }
      );
    }

    // Get all players in the session
    const playersResult = await db
      .prepare("SELECT * FROM players WHERE session_id = ?")
      .bind(session.id)
      .all<Player>();

    const players = playersResult.results;
    if (players.length < 4) {
      return NextResponse.json({ error: "Not enough players" }, { status: 400 });
    }

    // Fisher-Yates shuffle on player IDs
    const ids = players.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    // Assign staggered joined_at timestamps to preserve the shuffled order,
    // reset status to 'waiting' and clear last_result for a fresh start
    const now = Date.now();
    await Promise.all(
      ids.map((id, i) =>
        db
          .prepare(
            `UPDATE players SET status = 'waiting', last_result = NULL,
             joined_at = datetime(?, 'unixepoch') WHERE id = ?`
          )
          .bind(Math.floor(now / 1000) + i, id)
          .run()
      )
    );

    // Fill courts with the freshly shuffled queue
    await fillEmptyCourts(db, session);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
