import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as {
      match_id: number;
      out_player_id: number;
      in_player_id: number;
    };
    const { match_id, out_player_id, in_player_id } = body;

    if (!match_id || !out_player_id || !in_player_id) {
      return NextResponse.json({ error: "match_id, out_player_id, in_player_id required" }, { status: 400 });
    }

    const db = await getDB();

    const session = await db
      .prepare("SELECT id FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<{ id: number }>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify match is active and belongs to session
    const match = await db
      .prepare("SELECT * FROM matches WHERE id = ? AND session_id = ? AND is_active = 1")
      .bind(match_id, session.id)
      .first<{
        id: number;
        team_a_p1: number;
        team_a_p2: number;
        team_b_p1: number;
        team_b_p2: number;
      }>();

    if (!match) {
      return NextResponse.json({ error: "Active match not found" }, { status: 404 });
    }

    // Verify out_player is in the match
    const inMatch = [match.team_a_p1, match.team_a_p2, match.team_b_p1, match.team_b_p2];
    if (!inMatch.includes(out_player_id)) {
      return NextResponse.json({ error: "Player not in this match" }, { status: 400 });
    }

    // Verify in_player is waiting in this session
    const inPlayer = await db
      .prepare("SELECT id FROM players WHERE id = ? AND session_id = ? AND status = 'waiting'")
      .bind(in_player_id, session.id)
      .first<{ id: number }>();

    if (!inPlayer) {
      return NextResponse.json({ error: "Replacement player not found in queue" }, { status: 404 });
    }

    // Swap: update the match slot, then update both player statuses
    await db
      .prepare(`
        UPDATE matches SET
          team_a_p1 = CASE WHEN team_a_p1 = ? THEN ? ELSE team_a_p1 END,
          team_a_p2 = CASE WHEN team_a_p2 = ? THEN ? ELSE team_a_p2 END,
          team_b_p1 = CASE WHEN team_b_p1 = ? THEN ? ELSE team_b_p1 END,
          team_b_p2 = CASE WHEN team_b_p2 = ? THEN ? ELSE team_b_p2 END
        WHERE id = ?
      `)
      .bind(
        out_player_id, in_player_id,
        out_player_id, in_player_id,
        out_player_id, in_player_id,
        out_player_id, in_player_id,
        match_id
      )
      .run();

    // out_player → back to end of waiting queue
    await db
      .prepare("UPDATE players SET status = 'waiting', joined_at = datetime('now') WHERE id = ? AND session_id = ?")
      .bind(out_player_id, session.id)
      .run();

    // in_player → now playing
    await db
      .prepare("UPDATE players SET status = 'playing' WHERE id = ? AND session_id = ?")
      .bind(in_player_id, session.id)
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
