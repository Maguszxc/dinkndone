import type { Match, Player, Session } from "@/types";

/**
 * Core rotation engine. Called after a match ends.
 * Returns the new match created, or null if not enough players.
 */
export async function triggerRotation(
  db: D1Database,
  session: Session,
  endedMatch: Match,
  winnerTeam: "a" | "b" | null
): Promise<Match | null> {
  const courtNumber = endedMatch.court_number;

  // Determine who is staying on court (for types 2 & 3)
  const winnerIds: number[] =
    winnerTeam === "a"
      ? [endedMatch.team_a_p1, endedMatch.team_a_p2]
      : winnerTeam === "b"
      ? [endedMatch.team_b_p1, endedMatch.team_b_p2]
      : [];

  const loserIds: number[] =
    winnerTeam === "a"
      ? [endedMatch.team_b_p1, endedMatch.team_b_p2]
      : winnerTeam === "b"
      ? [endedMatch.team_a_p1, endedMatch.team_a_p2]
      : [
          endedMatch.team_a_p1,
          endedMatch.team_a_p2,
          endedMatch.team_b_p1,
          endedMatch.team_b_p2,
        ];

  // Return losers (and all players for Pure Queue) to the waiting queue
  if (loserIds.length > 0) {
    const placeholders = loserIds.map(() => "?").join(",");
    await db
      .prepare(
        `UPDATE players SET status = 'waiting', joined_at = datetime('now')
         WHERE id IN (${placeholders})`
      )
      .bind(...loserIds)
      .run();
  }

  // Fetch the current waiting queue (excludes winners who are still "playing")
  const queueResult = await db
    .prepare(
      `SELECT * FROM players
       WHERE session_id = ? AND status = 'waiting'
       ORDER BY joined_at ASC`
    )
    .bind(session.id)
    .all<Player>();

  const queue = queueResult.results;

  let teamA: [number, number];
  let teamB: [number, number];

  switch (session.rotation_type) {
    case 1: {
      // Pure Queue — need 4 players
      if (queue.length < 4) return null;
      teamA = [queue[0].id, queue[1].id];
      teamB = [queue[2].id, queue[3].id];
      break;
    }
    case 2: {
      // Winners Stay — winners keep their spot, 2 new challengers
      if (!winnerTeam || queue.length < 2) return null;
      teamA = [winnerIds[0], winnerIds[1]];
      teamB = [queue[0].id, queue[1].id];
      break;
    }
    case 3: {
      // Social Split — winners split partners with 2 new players
      if (!winnerTeam || queue.length < 2) return null;
      teamA = [winnerIds[0], queue[0].id];
      teamB = [winnerIds[1], queue[1].id];
      break;
    }
    default:
      return null;
  }

  const allNewPlayers = [...teamA, ...teamB];

  // Mark all new players as "playing"
  const placeholders2 = allNewPlayers.map(() => "?").join(",");
  await db
    .prepare(
      `UPDATE players SET status = 'playing'
       WHERE id IN (${placeholders2})`
    )
    .bind(...allNewPlayers)
    .run();

  // Create the new match
  const newMatch = await db
    .prepare(
      `INSERT INTO matches (session_id, court_number, team_a_p1, team_a_p2, team_b_p1, team_b_p2, is_active, started_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
       RETURNING *`
    )
    .bind(session.id, courtNumber, teamA[0], teamA[1], teamB[0], teamB[1])
    .first<Match>();

  return newMatch ?? null;
}

/**
 * Fill all empty courts from the queue. Used when starting a session
 * or when courts are idle and the queue has players.
 */
export async function fillEmptyCourts(
  db: D1Database,
  session: Session
): Promise<void> {
  for (let court = 1; court <= session.num_courts; court++) {
    const activeMatch = await db
      .prepare(
        `SELECT id FROM matches WHERE session_id = ? AND court_number = ? AND is_active = 1`
      )
      .bind(session.id, court)
      .first<{ id: number }>();

    if (activeMatch) continue; // Court already busy

    // Need 4 players
    const queueResult = await db
      .prepare(
        `SELECT * FROM players
         WHERE session_id = ? AND status = 'waiting'
         ORDER BY joined_at ASC LIMIT 4`
      )
      .bind(session.id)
      .all<Player>();

    const queue = queueResult.results;
    if (queue.length < 4) break; // Not enough players for this or any subsequent courts

    const [p1, p2, p3, p4] = queue;

    // Mark as playing
    await db
      .prepare(
        `UPDATE players SET status = 'playing' WHERE id IN (?, ?, ?, ?)`
      )
      .bind(p1.id, p2.id, p3.id, p4.id)
      .run();

    // Create match
    await db
      .prepare(
        `INSERT INTO matches (session_id, court_number, team_a_p1, team_a_p2, team_b_p1, team_b_p2, is_active, started_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`
      )
      .bind(session.id, court, p1.id, p2.id, p3.id, p4.id)
      .run();
  }
}
