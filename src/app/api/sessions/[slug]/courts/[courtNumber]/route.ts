import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; courtNumber: string }> }
) {
  try {
    const { slug, courtNumber } = await params;
    const courtNum = parseInt(courtNumber, 10);
    const body = (await request.json()) as { status: "active" | "disabled" };

    if (isNaN(courtNum)) {
      return NextResponse.json({ error: "Invalid court number" }, { status: 400 });
    }
    if (body.status !== "active" && body.status !== "disabled") {
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

    const court = await db
      .prepare("SELECT id FROM courts WHERE session_id = ? AND court_number = ?")
      .bind(session.id, courtNum)
      .first<{ id: number }>();

    if (!court) {
      return NextResponse.json({ error: "Court not found" }, { status: 404 });
    }

    if (body.status === "disabled") {
      const activeMatch = await db
        .prepare("SELECT id FROM matches WHERE session_id = ? AND court_number = ? AND is_active = 1")
        .bind(session.id, courtNum)
        .first<{ id: number }>();

      if (activeMatch) {
        return NextResponse.json(
          { error: "Cannot disable a court with an active match" },
          { status: 409 }
        );
      }
    }

    await db
      .prepare("UPDATE courts SET status = ? WHERE id = ?")
      .bind(body.status, court.id)
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
