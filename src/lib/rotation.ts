import type { Match, Player, Session } from "@/types";

async function getWaitingQueue(db: D1Database, sessionId: number): Promise<Player[]> {
  const result = await db
    .prepare(`SELECT * FROM players WHERE session_id = ? AND status = 'waiting' ORDER BY joined_at ASC`)
    .bind(sessionId)
    .all<Player>();
  return result.results;
}

async function getWaitingByResult(
  db: D1Database,
  sessionId: number,
  result: "won" | "lost"
): Promise<Player[]> {
  const res = await db
    .prepare(
      `SELECT * FROM players WHERE session_id = ? AND status = 'waiting' AND last_result = ? ORDER BY joined_at ASC`
    )
    .bind(sessionId, result)
    .all<Player>();
  return res.results;
}

async function markPlayersWaiting(
  db: D1Database,
  playerIds: number[],
  lastResult?: "won" | "lost"
): Promise<void> {
  if (playerIds.length === 0) return;
  const placeholders = playerIds.map(() => "?").join(",");
  if (lastResult) {
    await db
      .prepare(
        `UPDATE players SET status = 'waiting', joined_at = datetime('now'), last_result = ?
         WHERE id IN (${placeholders})`
      )
      .bind(lastResult, ...playerIds)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE players SET status = 'waiting', joined_at = datetime('now')
         WHERE id IN (${placeholders})`
      )
      .bind(...playerIds)
      .run();
  }
}

async function createMatch(
  db: D1Database,
  sessionId: number,
  courtNumber: number,
  teamA: [number, number],
  teamB: [number, number]
): Promise<Match | null> {
  const allPlayers = [...teamA, ...teamB];
  const placeholders = allPlayers.map(() => "?").join(",");
  await db
    .prepare(`UPDATE players SET status = 'playing' WHERE id IN (${placeholders})`)
    .bind(...allPlayers)
    .run();

  const newMatch = await db
    .prepare(
      `INSERT INTO matches (session_id, court_number, team_a_p1, team_a_p2, team_b_p1, team_b_p2, is_active, started_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now')) RETURNING *`
    )
    .bind(sessionId, courtNumber, teamA[0], teamA[1], teamB[0], teamB[1])
    .first<Match>();

  return newMatch ?? null;
}

/**
 * Assemble the next 4 players for a court based on rotation type.
 * Returns [teamA, teamB] or null if not enough players.
 */
async function assembleNextMatch(
  db: D1Database,
  session: Session
): Promise<[[number, number], [number, number]] | null> {
  switch (session.rotation_type) {
    case 1: {
      // Pure Queue — next 4 in line, paired 1+2 vs 3+4
      const queue = await getWaitingQueue(db, session.id);
      if (queue.length < 4) return null;
      return [
        [queue[0].id, queue[1].id],
        [queue[2].id, queue[3].id],
      ];
    }

    case 2: {
      // Win vs Win & Lose vs Lose
      // Priority: 4 winners → 4 losers → general queue fallback
      const winners = await getWaitingByResult(db, session.id, "won");
      if (winners.length >= 4) {
        return [
          [winners[0].id, winners[1].id],
          [winners[2].id, winners[3].id],
        ];
      }
      const losers = await getWaitingByResult(db, session.id, "lost");
      if (losers.length >= 4) {
        return [
          [losers[0].id, losers[1].id],
          [losers[2].id, losers[3].id],
        ];
      }
      // Not enough same-tier players — fall back to general queue
      const queue = await getWaitingQueue(db, session.id);
      if (queue.length < 4) return null;
      return [
        [queue[0].id, queue[1].id],
        [queue[2].id, queue[3].id],
      ];
    }

    case 3: {
      // Social Split — next 4 in queue, paired 1+3 vs 2+4 to mix partners
      const queue = await getWaitingQueue(db, session.id);
      if (queue.length < 4) return null;
      return [
        [queue[0].id, queue[2].id],
        [queue[1].id, queue[3].id],
      ];
    }

    default:
      return null;
  }
}

/**
 * Core rotation engine. Called after a match ends.
 */
export async function triggerRotation(
  db: D1Database,
  session: Session,
  endedMatch: Match,
  winnerTeam: "a" | "b" | null
): Promise<Match | null> {
  const winnerIds: number[] =
    !winnerTeam
      ? []
      : winnerTeam === "a"
      ? [endedMatch.team_a_p1, endedMatch.team_a_p2]
      : [endedMatch.team_b_p1, endedMatch.team_b_p2];

  const loserIds: number[] =
    !winnerTeam
      ? [endedMatch.team_a_p1, endedMatch.team_a_p2, endedMatch.team_b_p1, endedMatch.team_b_p2]
      : winnerTeam === "a"
      ? [endedMatch.team_b_p1, endedMatch.team_b_p2]
      : [endedMatch.team_a_p1, endedMatch.team_a_p2];

  // Return players to waiting queue
  if (session.rotation_type === 2 && winnerTeam) {
    // Tag winners and losers separately for tier tracking
    await markPlayersWaiting(db, winnerIds, "won");
    await markPlayersWaiting(db, loserIds, "lost");
  } else {
    // Types 1 & 3: everyone back to waiting, no tier tagging
    const all = [endedMatch.team_a_p1, endedMatch.team_a_p2, endedMatch.team_b_p1, endedMatch.team_b_p2];
    await markPlayersWaiting(db, all);
  }

  // Assemble and create the next match
  const teams = await assembleNextMatch(db, session);
  if (!teams) return null;

  return createMatch(db, session.id, endedMatch.court_number, teams[0], teams[1]);
}

/**
 * Fill all empty courts from the queue. Used when starting a session
 * or when other courts are idle after a rotation.
 */
export async function fillEmptyCourts(db: D1Database, session: Session): Promise<void> {
  for (let court = 1; court <= session.num_courts; court++) {
    const activeMatch = await db
      .prepare(`SELECT id FROM matches WHERE session_id = ? AND court_number = ? AND is_active = 1`)
      .bind(session.id, court)
      .first<{ id: number }>();

    if (activeMatch) continue;

    const teams = await assembleNextMatch(db, session);
    if (!teams) break; // Not enough players for this or any further courts

    await createMatch(db, session.id, court, teams[0], teams[1]);
  }
}
