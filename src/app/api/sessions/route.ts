import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

const MAX_ACTIVE_SESSIONS = 10;
const MAX_PLAYERS_PER_SESSION = 100;
const IDLE_EXPIRY_SECONDS = 90 * 60; // 90 minutes

function generateSlug(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let slug = "";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    slug += chars[b % chars.length];
  }
  return slug;
}

export async function GET() {
  try {
    const db = await getDB();
    const result = await db
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE is_active = 1")
      .first<{ count: number }>();
    const count = result?.count ?? 0;
    return NextResponse.json({
      active_sessions: count,
      max_sessions: MAX_ACTIVE_SESSIONS,
      max_players: MAX_PLAYERS_PER_SESSION,
      at_capacity: count >= MAX_ACTIVE_SESSIONS,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      group_name: string;
      num_courts: number;
      rotation_type: number;
    };

    const { group_name, num_courts, rotation_type } = body;

    if (!group_name?.trim()) {
      return NextResponse.json({ error: "Group name required" }, { status: 400 });
    }
    if (num_courts < 1 || num_courts > 6) {
      return NextResponse.json({ error: "Courts must be 1–6" }, { status: 400 });
    }
    if (![1, 2, 3].includes(rotation_type)) {
      return NextResponse.json({ error: "Invalid rotation type" }, { status: 400 });
    }

    const db = await getDB();

    // Lazy cleanup: delete active sessions idle for 90+ minutes
    await db
      .prepare(
        `DELETE FROM sessions WHERE is_active = 1 AND (
          (last_match_at IS NOT NULL AND last_match_at < unixepoch() - ?) OR
          (last_match_at IS NULL AND unixepoch(created_at) < unixepoch() - ?)
        )`
      )
      .bind(IDLE_EXPIRY_SECONDS, IDLE_EXPIRY_SECONDS)
      .run();

    // Check session cap
    const activeCount = await db
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE is_active = 1")
      .first<{ count: number }>();
    if ((activeCount?.count ?? 0) >= MAX_ACTIVE_SESSIONS) {
      return NextResponse.json(
        { error: "Server is at capacity. All 10 session slots are in use. Try again later." },
        { status: 503 }
      );
    }

    let slug = generateSlug();

    // Ensure slug uniqueness (retry once)
    const existing = await db
      .prepare("SELECT id FROM sessions WHERE slug = ?")
      .bind(slug)
      .first();
    if (existing) slug = generateSlug();

    const session = await db
      .prepare(
        `INSERT INTO sessions (group_name, slug, num_courts, rotation_type, is_active)
         VALUES (?, ?, ?, ?, 0) RETURNING *`
      )
      .bind(group_name.trim(), slug, num_courts, rotation_type)
      .first();

    return NextResponse.json({ slug: (session as { slug: string }).slug }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
