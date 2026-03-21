CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  num_courts INTEGER NOT NULL DEFAULT 2,
  rotation_type INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_number INTEGER NOT NULL,
  team_a_p1 INTEGER NOT NULL REFERENCES players(id),
  team_a_p2 INTEGER NOT NULL REFERENCES players(id),
  team_b_p1 INTEGER NOT NULL REFERENCES players(id),
  team_b_p2 INTEGER NOT NULL REFERENCES players(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  winner_team TEXT
);

CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id, status, joined_at);
CREATE INDEX IF NOT EXISTS idx_matches_session ON matches(session_id, is_active);
