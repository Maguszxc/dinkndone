import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { Player, Session } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { password: string };
    const password = body.password?.trim().toUpperCase();

    if (!password) {
      return NextResponse.json({ error: "Recovery code required" }, { status: 400 });
    }

    const db = await getDB();

    const session = await db
      .prepare("SELECT * FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<Session>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const player = await db
      .prepare("SELECT * FROM players WHERE session_id = ? AND password = ?")
      .bind(session.id, password)
      .first<Player>();

    if (!player) {
      return NextResponse.json(
        { error: "Recovery code not found in this session" },
        { status: 404 }
      );
    }

    const posResult = await db
      .prepare(
        `SELECT COUNT(*) as pos FROM players
         WHERE session_id = ? AND status = 'waiting' AND joined_at <= ?`
      )
      .bind(session.id, player.joined_at)
      .first<{ pos: number }>();

    return NextResponse.json({ player, position: posResult?.pos ?? 1 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
