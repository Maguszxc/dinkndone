import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { host_password: string };
    const code = body.host_password?.trim().toUpperCase();

    if (!code || code.length !== 10) {
      return NextResponse.json({ error: "Invalid recovery code" }, { status: 400 });
    }

    const db = await getDB();

    const session = await db
      .prepare("SELECT slug FROM sessions WHERE host_password = ?")
      .bind(code)
      .first<{ slug: string }>();

    if (!session) {
      return NextResponse.json({ error: "Recovery code not found" }, { status: 404 });
    }

    return NextResponse.json({ slug: session.slug });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
