import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; playerId: string }> }
) {
  try {
    const { slug, playerId } = await params;
    const playerIdNum = parseInt(playerId, 10);

    if (isNaN(playerIdNum)) {
      return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
    }

    const db = await getDB();

    const session = await db
      .prepare("SELECT id FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<{ id: number }>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const player = await db
      .prepare("SELECT id, status FROM players WHERE id = ? AND session_id = ?")
      .bind(playerIdNum, session.id)
      .first<{ id: number; status: string }>();

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (player.status === "playing") {
      return NextResponse.json(
        { error: "Cannot remove a player currently in a match" },
        { status: 409 }
      );
    }

    await db
      .prepare("DELETE FROM players WHERE id = ? AND session_id = ?")
      .bind(playerIdNum, session.id)
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
