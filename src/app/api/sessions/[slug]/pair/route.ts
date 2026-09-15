import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { Player, Session } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { player_id_1: number; player_id_2: number };
    const { player_id_1, player_id_2 } = body;

    if (!player_id_1 || !player_id_2 || player_id_1 === player_id_2) {
      return NextResponse.json({ error: "Two different players required" }, { status: 400 });
    }

    const db = await getDB();

    const session = await db
      .prepare("SELECT * FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<Session>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const players = await db
      .prepare("SELECT * FROM players WHERE session_id = ? AND id IN (?, ?)")
      .bind(session.id, player_id_1, player_id_2)
      .all<Player>();

    if (players.results.length !== 2) {
      return NextResponse.json({ error: "Players not found" }, { status: 404 });
    }

    // Break any existing pairing on either player first, then bind the new pair
    await db
      .prepare(
        `UPDATE players SET partner_id = NULL WHERE session_id = ? AND partner_id IN (?, ?)`
      )
      .bind(session.id, player_id_1, player_id_2)
      .run();

    await db
      .prepare(`UPDATE players SET partner_id = ? WHERE id = ?`)
      .bind(player_id_2, player_id_1)
      .run();
    await db
      .prepare(`UPDATE players SET partner_id = ? WHERE id = ?`)
      .bind(player_id_1, player_id_2)
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
