export interface Session {
  id: number;
  group_name: string;
  slug: string;
  num_courts: number;
  rotation_type: 1 | 2 | 3; // 1: Pure Queue, 2: Winners Stay, 3: Social Split
  is_active: number; // 0 | 1 (SQLite boolean)
  created_at: string;
}

export interface Player {
  id: number;
  session_id: number;
  name: string;
  status: "waiting" | "playing";
  joined_at: string;
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

export interface BoardData {
  session: Session;
  activeMatches: MatchWithPlayers[];
  waitingPlayers: Player[];
  allPlayers: Player[];
}

export const ROTATION_LABELS: Record<number, string> = {
  1: "Pure Queue",
  2: "Winners Stay",
  3: "Social Split",
};
