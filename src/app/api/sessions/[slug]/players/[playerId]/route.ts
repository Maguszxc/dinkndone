import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; playerId: string }> }
) {
  try {
    const { slug, playerId } = await params;
    const playerIdNum = parseInt(playerId, 10);
    const body = (await request.json()) as { status: "waiting" | "standby" };

    if (isNaN(playerIdNum)) {
      return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
    }
    if (body.status !== "waiting" && body.status !== "standby") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
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

    if (body.status === "standby") {
      if (player.status !== "waiting") {
        return NextResponse.json(
          { error: "Only waiting players can be moved to standby" },
          { status: 409 }
        );
      }
      await db.prepare("UPDATE players SET status = 'standby' WHERE id = ?").bind(playerIdNum).run();
    } else {
      // Restore from standby to the back of the main queue
      await db
        .prepare("UPDATE players SET status = 'waiting', joined_at = datetime('now') WHERE id = ?")
        .bind(playerIdNum)
        .run();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    if (player.status !== "standby") {
      return NextResponse.json(
        { error: "Move the player to standby before deleting them permanently" },
        { status: 403 }
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
