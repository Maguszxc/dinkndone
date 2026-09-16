import type { Match, Player, Session } from "@/types";

async function getWaitingQueue(db: D1Database, sessionId: number): Promise<Player[]> {
  const result = await db
    .prepare(`SELECT * FROM players WHERE session_id = ? AND status = 'waiting' ORDER BY joined_at ASC`)
    .bind(sessionId)
    .all<Player>();
  return result.results;
}

async function getWaitingByTier(
  db: D1Database,
  sessionId: number,
  tier: "main" | "won" | "lost"
): Promise<Player[]> {
  const clause = tier === "main" ? "last_result IS NULL" : "last_result = ?";
  const binds = tier === "main" ? [sessionId] : [sessionId, tier];
  const res = await db
    .prepare(
      `SELECT * FROM players WHERE session_id = ? AND status = 'waiting' AND ${clause} ORDER BY joined_at ASC`
    )
    .bind(...binds)
    .all<Player>();
  return res.results;
}

/**
 * Self-heal players left with status='playing' but no active match
 * referencing them (e.g. after an odd sequence of host actions).
 */
export async function reconcileStuckPlayers(db: D1Database, sessionId: number): Promise<void> {
  await db
    .prepare(
      `UPDATE players SET status = 'waiting', joined_at = datetime('now')
       WHERE session_id = ? AND status = 'playing' AND id NOT IN (
         SELECT team_a_p1 FROM matches WHERE session_id = ? AND is_active = 1
         UNION SELECT team_a_p2 FROM matches WHERE session_id = ? AND is_active = 1
         UNION SELECT team_b_p1 FROM matches WHERE session_id = ? AND is_active = 1
         UNION SELECT team_b_p2 FROM matches WHERE session_id = ? AND is_active = 1
       )`
    )
    .bind(sessionId, sessionId, sessionId, sessionId, sessionId)
    .run();
}

async function getActiveCourtNumbers(db: D1Database, sessionId: number): Promise<number[]> {
  const res = await db
    .prepare(`SELECT court_number FROM courts WHERE session_id = ? AND status = 'active' ORDER BY court_number ASC`)
    .bind(sessionId)
    .all<{ court_number: number }>();
  return res.results.map((r) => r.court_number);
}

async function getRecentTeammates(
  db: D1Database,
  sessionId: number,
  playerIds: number[]
): Promise<Map<number, Set<number>>> {
  const map = new Map<number, Set<number>>();
  if (playerIds.length === 0) return map;
  const placeholders = playerIds.map(() => "?").join(",");
  const res = await db
    .prepare(
      `SELECT team_a_p1, team_a_p2, team_b_p1, team_b_p2 FROM matches
       WHERE session_id = ? AND is_active = 0
         AND (team_a_p1 IN (${placeholders}) OR team_a_p2 IN (${placeholders})
              OR team_b_p1 IN (${placeholders}) OR team_b_p2 IN (${placeholders}))
       ORDER BY ended_at DESC LIMIT 50`
    )
    .bind(sessionId, ...playerIds, ...playerIds, ...playerIds, ...playerIds)
    .all<{ team_a_p1: number; team_a_p2: number; team_b_p1: number; team_b_p2: number }>();

  const addPair = (a: number, b: number) => {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  };

  for (const m of res.results) {
    // Only record the most recent teammate pairing seen per player.
    if (!map.has(m.team_a_p1) || !map.has(m.team_a_p2)) addPair(m.team_a_p1, m.team_a_p2);
    if (!map.has(m.team_b_p1) || !map.has(m.team_b_p2)) addPair(m.team_b_p1, m.team_b_p2);
  }
  return map;
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

/**
 * Try to keep bound partners on the same team. Only looks at the first
 * few players in the queue so a distant pair can't jump far ahead of
 * people who have been waiting longer. Falls back to plain FIFO pairing
 * (1+2 vs 3+4) if partners can't be cleanly grouped within that window.
 */
function assembleFromQueue(
  queue: Player[],
  recentTeammates?: Map<number, Set<number>>
): [[number, number], [number, number]] | null {
  if (queue.length < 4) return null;

  const LOOKAHEAD = 8;
  const windowed = queue.slice(0, LOOKAHEAD);
  const idSet = new Set(windowed.map((p) => p.id));
  const visited = new Set<number>();
  const units: number[][] = [];

  for (const p of windowed) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);
    if (p.partner_id && idSet.has(p.partner_id) && !visited.has(p.partner_id)) {
      visited.add(p.partner_id);
      units.push([p.id, p.partner_id]);
    } else {
      units.push([p.id]);
    }
  }

  const buildTeams = (orderedUnits: number[][]) => {
    const teamA: number[] = [];
    const teamB: number[] = [];
    for (const unit of orderedUnits) {
      if (teamA.length === 2 && teamB.length === 2) break;
      if (unit.length + teamA.length <= 2) teamA.push(...unit);
      else if (unit.length + teamB.length <= 2) teamB.push(...unit);
    }
    return { teamA, teamB };
  };

  // Best-effort: if the front-of-queue units would recreate the exact
  // same (non-partner) teammate pairing as their last match, try
  // reordering solo units within the window before falling back.
  if (recentTeammates && units.length > 2) {
    const wasRecentTeammates = (a: number, b: number) => recentTeammates.get(a)?.has(b) ?? false;
    const naive = buildTeams(units);
    const naiveRepeats =
      naive.teamA.length === 2 && wasRecentTeammates(naive.teamA[0], naive.teamA[1]) ? 1 : 0;
    if (naiveRepeats > 0) {
      for (let i = 2; i < units.length; i++) {
        const reordered = [units[0], units[i], ...units.filter((_, idx) => idx !== 0 && idx !== i)];
        const attempt = buildTeams(reordered);
        if (
          attempt.teamA.length === 2 &&
          attempt.teamB.length === 2 &&
          !wasRecentTeammates(attempt.teamA[0], attempt.teamA[1]) &&
          !wasRecentTeammates(attempt.teamB[0], attempt.teamB[1])
        ) {
          return [
            [attempt.teamA[0], attempt.teamA[1]],
            [attempt.teamB[0], attempt.teamB[1]],
          ];
        }
      }
    }
  }

  const { teamA, teamB } = buildTeams(units);

  if (teamA.length === 2 && teamB.length === 2) {
    return [
      [teamA[0], teamA[1]],
      [teamB[0], teamB[1]],
    ];
  }

  // Couldn't cleanly group partners within the lookahead window —
  // fall back to plain FIFO so the court always fills.
  return [
    [queue[0].id, queue[1].id],
    [queue[2].id, queue[3].id],
  ];
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
      // Pure Queue — next 4 in line, bound partners kept together when possible
      const queue = await getWaitingQueue(db, session.id);
      const teammates = await getRecentTeammates(db, session.id, queue.slice(0, 8).map((p) => p.id));
      return assembleFromQueue(queue, teammates);
    }

    case 2: {
      // Main Queue always has priority; fill any remaining slots from
      // the Winner tier, then the Loser tier. Each tier is FIFO by
      // joined_at, and winners/losers are appended to the back of
      // their tier (joined_at reset to now) when they finish a match,
      // so nobody already waiting gets bypassed.
      const main = await getWaitingByTier(db, session.id, "main");
      const winners = await getWaitingByTier(db, session.id, "won");
      const losers = await getWaitingByTier(db, session.id, "lost");
      const combined = [...main, ...winners, ...losers];
      const teammates = await getRecentTeammates(db, session.id, combined.slice(0, 8).map((p) => p.id));
      return assembleFromQueue(combined, teammates);
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
  winnerTeam: "a" | "b" | null,
  refill: boolean = true
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

  // Leave the court empty until the host manually fills it
  if (!refill) return null;

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
  const activeCourts = await getActiveCourtNumbers(db, session.id);
  for (const court of activeCourts) {
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
