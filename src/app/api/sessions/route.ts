import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";


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
