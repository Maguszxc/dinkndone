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
      team_a_p1: number;
      team_a_p2: number;
      team_b_p1: number;
      team_b_p2: number;
    };
    const { match_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2 } = body;

    const ids = [team_a_p1, team_a_p2, team_b_p1, team_b_p2];
    if (ids.some((id) => !id) || new Set(ids).size !== 4) {
      return NextResponse.json(
        { error: "Must provide 4 distinct player IDs" },
        { status: 400 }
      );
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
      .prepare(
        "SELECT id, team_a_p1, team_a_p2, team_b_p1, team_b_p2 FROM matches WHERE id = ? AND session_id = ? AND is_active = 1"
      )
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

    // Ensure all 4 provided IDs are actually the match's players
    const matchPlayerIds = new Set([
      match.team_a_p1,
      match.team_a_p2,
      match.team_b_p1,
      match.team_b_p2,
    ]);
    if (ids.some((id) => !matchPlayerIds.has(id))) {
      return NextResponse.json(
        { error: "All players must already be in this match" },
        { status: 400 }
      );
    }

    await db
      .prepare(
        `UPDATE matches SET team_a_p1 = ?, team_a_p2 = ?, team_b_p1 = ?, team_b_p2 = ?
         WHERE id = ? AND session_id = ?`
      )
      .bind(team_a_p1, team_a_p2, team_b_p1, team_b_p2, match_id, session.id)
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
