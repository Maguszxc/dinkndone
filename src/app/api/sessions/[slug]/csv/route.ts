import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import type { Session } from "@/types";


interface MatchRow {
  id: number;
  court_number: number;
  started_at: string;
  ended_at: string | null;
  winner_team: string | null;
  team_a_p1_name: string;
  team_a_p2_name: string;
  team_b_p1_name: string;
  team_b_p2_name: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = await getDB();

    const session = await db
      .prepare("SELECT * FROM sessions WHERE slug = ?")
      .bind(slug)
      .first<Session>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const result = await db
      .prepare(
        `SELECT m.id, m.court_number, m.started_at, m.ended_at, m.winner_team,
           pa1.name as team_a_p1_name, pa2.name as team_a_p2_name,
           pb1.name as team_b_p1_name, pb2.name as team_b_p2_name
         FROM matches m
         JOIN players pa1 ON m.team_a_p1 = pa1.id
         JOIN players pa2 ON m.team_a_p2 = pa2.id
         JOIN players pb1 ON m.team_b_p1 = pb1.id
         JOIN players pb2 ON m.team_b_p2 = pb2.id
         WHERE m.session_id = ?
         ORDER BY m.started_at ASC`
      )
      .bind(session.id)
      .all<MatchRow>();

    const rows = result.results;
    const lines: string[] = ["#,Court,Team A,Team B,Winner,Started,Ended"];

    rows.forEach((r, i) => {
      const teamA = `${r.team_a_p1_name} & ${r.team_a_p2_name}`;
      const teamB = `${r.team_b_p1_name} & ${r.team_b_p2_name}`;
      const winner =
        r.winner_team === "a" ? teamA
        : r.winner_team === "b" ? teamB
        : "No winner";
      lines.push(
        [
          `Match ${i + 1}`,
          `Court ${r.court_number}`,
          teamA,
          teamB,
          winner,
          r.started_at,
          r.ended_at ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    });

    const csv = lines.join("\n");
    const filename = `dinkndone-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
