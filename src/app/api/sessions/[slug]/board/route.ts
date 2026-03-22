import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { BoardData, Match, MatchWithPlayers, Player, Session } from "@/types";


export async function GET(
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

    const playerJoin = `
      JOIN players pa1 ON m.team_a_p1 = pa1.id
      JOIN players pa2 ON m.team_a_p2 = pa2.id
      JOIN players pb1 ON m.team_b_p1 = pb1.id
      JOIN players pb2 ON m.team_b_p2 = pb2.id`;

    const matchSelect = `SELECT m.*,
      pa1.name as team_a_p1_name, pa2.name as team_a_p2_name,
      pb1.name as team_b_p1_name, pb2.name as team_b_p2_name
      FROM matches m ${playerJoin}`;

    const [matchesResult, waitingResult, allPlayersResult, recentlyEndedResult] =
      await Promise.all([
        db
          .prepare(`${matchSelect} WHERE m.session_id = ? AND m.is_active = 1 ORDER BY m.court_number ASC`)
          .bind(session.id)
          .all<MatchWithPlayers>(),
        db
          .prepare(`SELECT * FROM players WHERE session_id = ? AND status = 'waiting' ORDER BY joined_at ASC`)
          .bind(session.id)
          .all<Player>(),
        db
          .prepare(`SELECT * FROM players WHERE session_id = ? ORDER BY joined_at ASC`)
          .bind(session.id)
          .all<Player>(),
        db
          .prepare(`${matchSelect} WHERE m.session_id = ? AND m.is_active = 0 AND m.ended_at >= datetime('now', '-90 seconds') ORDER BY m.ended_at DESC`)
          .bind(session.id)
          .all<MatchWithPlayers>(),
      ]);

    const board: BoardData = {
      session,
      activeMatches: matchesResult.results,
      waitingPlayers: waitingResult.results,
      allPlayers: allPlayersResult.results,
      recentlyEnded: recentlyEndedResult.results,
    };

    return NextResponse.json(board);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
