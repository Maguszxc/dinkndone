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
    const body = (await request.json()) as { match_id: number; player_id: number };

    if (!body.match_id || !body.player_id) {
      return NextResponse.json({ error: "match_id and player_id required" }, { status: 400 });
    }

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
      .first<Match & { loss_reporter_1: number | null }>();

    if (!match) {
      return NextResponse.json({ error: "Active match not found" }, { status: 404 });
    }

    // Verify this player is actually in the match
    const allPlayers = [match.team_a_p1, match.team_a_p2, match.team_b_p1, match.team_b_p2];
    if (!allPlayers.includes(body.player_id)) {
      return NextResponse.json({ error: "You are not in this match" }, { status: 403 });
    }

    // Determine losing team from reporter's position
    const isTeamA = match.team_a_p1 === body.player_id || match.team_a_p2 === body.player_id;
    const losers = isTeamA
      ? [match.team_a_p1, match.team_a_p2]
      : [match.team_b_p1, match.team_b_p2];
    const winners = allPlayers.filter((id) => !losers.includes(id));

    // Rewrite the match record with real teams: losers = team_a, winners = team_b
    await db
      .prepare(
        `UPDATE matches
         SET team_a_p1 = ?, team_a_p2 = ?, team_b_p1 = ?, team_b_p2 = ?,
             is_active = 0, ended_at = datetime('now'), winner_team = 'b'
         WHERE id = ?`
      )
      .bind(losers[0], losers[1], winners[0], winners[1], match.id)
      .run();

    const closedMatch: Match = {
      ...match,
      team_a_p1: losers[0],
      team_a_p2: losers[1],
      team_b_p1: winners[0],
      team_b_p2: winners[1],
      is_active: 0,
      winner_team: "b",
      ended_at: new Date().toISOString(),
    };

    await triggerRotation(db, session, closedMatch, "b");
    await fillEmptyCourts(db, session);

    return NextResponse.json({ status: "ended" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
