export interface Session {
  id: number;
  group_name: string;
  slug: string;
  num_courts: number;
  rotation_type: 1 | 2 | 3; // 1: Pure Queue, 2: Win/Lose
  show_leaderboard: number; // 0 | 1
  is_active: number; // 0 | 1 (SQLite boolean)
  created_at: string;
  last_match_at: number | null; // Unix timestamp, updated when a match starts or ends
}

export interface Player {
  id: number;
  session_id: number;
  name: string;
  status: "waiting" | "playing";
  joined_at: string;
  password: string | null;
  last_result: "won" | "lost" | null;
  partner_id: number | null;
}

export interface Match {
  id: number;
  session_id: number;
  court_number: number;
  team_a_p1: number;
  team_a_p2: number;
  team_b_p1: number;
  team_b_p2: number;
  is_active: number; // 0 | 1
  started_at: string;
  ended_at: string | null;
  winner_team: "a" | "b" | null;
}

export interface MatchWithPlayers extends Match {
  team_a_p1_name: string;
  team_a_p2_name: string;
  team_b_p1_name: string;
  team_b_p2_name: string;
}

export interface LeaderboardEntry {
  id: number;
  name: string;
  wins: number;
  losses: number;
  games: number;
}

export interface BoardData {
  session: Session;
  activeMatches: MatchWithPlayers[];
  waitingPlayers: Player[];
  allPlayers: Player[];
  recentlyEnded: MatchWithPlayers[];
  leaderboard: LeaderboardEntry[];
}

export const ROTATION_LABELS: Record<number, string> = {
  1: "Pure Queue",
  2: "Win / Lose",
  3: "Social Split",
};
