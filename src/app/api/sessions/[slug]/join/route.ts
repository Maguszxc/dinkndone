import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { Player, Session } from "@/types";


export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { name: string };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    if (name.length > 30) {
      return NextResponse.json({ error: "Name too long (max 30 chars)" }, { status: 400 });
    }

    const db = await getDB();

    const session = await db
      .prepare("SELECT * FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<Session>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check for duplicate name in this session
    const duplicate = await db
      .prepare("SELECT id FROM players WHERE session_id = ? AND LOWER(name) = LOWER(?)")
      .bind(session.id, name)
      .first();

    if (duplicate) {
      return NextResponse.json(
        { error: "A player with that name already joined" },
        { status: 409 }
      );
    }

    const player = await db
      .prepare(
        `INSERT INTO players (session_id, name, status)
         VALUES (?, ?, 'waiting') RETURNING *`
      )
      .bind(session.id, name)
      .first<Player>();

    // Count their queue position
    const posResult = await db
      .prepare(
        `SELECT COUNT(*) as pos FROM players
         WHERE session_id = ? AND status = 'waiting' AND joined_at <= ?`
      )
      .bind(session.id, player!.joined_at)
      .first<{ pos: number }>();

    return NextResponse.json(
      { player, position: posResult?.pos ?? 1 },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
