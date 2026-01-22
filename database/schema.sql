-- =====================================================
-- STRIKE MASTER DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. SCHOOLS TABLE
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Pascack Hills as the only school for now
INSERT INTO schools (name) VALUES ('Pascack Hills') ON CONFLICT (name) DO NOTHING;

-- 2. DROP existing constraints if they exist (to recreate cleanly)
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_role_check;

-- 3. USERS TABLE (coaches/directors)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'coach',
  school_id UUID REFERENCES schools(id),
  coach_code VARCHAR(10) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (safe migration)
DO $$
BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_code VARCHAR(10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. TEAMS TABLE (boys/girls teams per school)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('boys', 'girls')),
  school_name VARCHAR(255),
  school_id UUID REFERENCES schools(id),
  director_id UUID REFERENCES users(id),
  division VARCHAR(100),
  county VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (safe migration)
DO $$
BEGIN
  ALTER TABLE teams ADD COLUMN IF NOT EXISTS director_id UUID REFERENCES users(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE teams ADD COLUMN IF NOT EXISTS school_name VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('boys', 'girls')),
  grad_year INTEGER,
  email VARCHAR(255),
  team_id UUID REFERENCES teams(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (safe migration)
DO $$
BEGIN
  ALTER TABLE players ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE players ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE players ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE players ADD COLUMN IF NOT EXISTS grad_year INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE players ADD COLUMN IF NOT EXISTS email VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. OPPONENTS TABLE (other teams you play against)
CREATE TABLE IF NOT EXISTS opponents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. MATCHES TABLE (games/events)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  opponent_id UUID REFERENCES opponents(id),
  match_date DATE NOT NULL,
  location VARCHAR(255),
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. PLAYER_SCORES TABLE (individual game scores)
CREATE TABLE IF NOT EXISTS player_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_number INTEGER CHECK (game_number IN (1, 2, 3)),
  score INTEGER CHECK (score >= 0 AND score <= 300),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id, game_number)
);

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id);
CREATE INDEX IF NOT EXISTS idx_scores_match ON player_scores(match_id);
CREATE INDEX IF NOT EXISTS idx_scores_player ON player_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_teams_director ON teams(director_id);
CREATE INDEX IF NOT EXISTS idx_users_coach_code ON users(coach_code);

-- 10. Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponents ENABLE ROW LEVEL SECURITY;

-- 11. Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Service role full access" ON teams;
DROP POLICY IF EXISTS "Service role full access" ON players;
DROP POLICY IF EXISTS "Service role full access" ON matches;
DROP POLICY IF EXISTS "Service role full access" ON player_scores;
DROP POLICY IF EXISTS "Service role full access" ON schools;
DROP POLICY IF EXISTS "Service role full access" ON opponents;

-- 12. Create permissive policies (allows API with service role to access everything)
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON player_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON schools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON opponents FOR ALL USING (true) WITH CHECK (true);

-- 13. Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;