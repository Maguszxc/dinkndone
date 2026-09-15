ALTER TABLE players ADD COLUMN partner_id INTEGER REFERENCES players(id);
