CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(session_id, court_number)
);

CREATE INDEX IF NOT EXISTS idx_courts_session ON courts(session_id, status);

INSERT INTO courts (session_id, court_number, status)
SELECT s.id, n.n, 'active'
FROM sessions s
JOIN (
  WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 6)
  SELECT n FROM seq
) n ON n.n <= s.num_courts;
