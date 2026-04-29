-- VotRO: Romanian Senate Vote Tracker
-- Migration 001: Initial schema

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE vote_choice AS ENUM ('for', 'against', 'abstention', 'not_voted', 'absent');
CREATE TYPE chamber AS ENUM ('senate', 'deputies');

-- ============================================================
-- parties
-- ============================================================
CREATE TABLE IF NOT EXISTS parties (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    abbreviation TEXT UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- politicians
-- ============================================================
CREATE TABLE IF NOT EXISTS politicians (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,          -- family name (Nume)
    first_name        TEXT NOT NULL,          -- given name (Prenume)
    party_id          UUID REFERENCES parties(id) ON DELETE SET NULL,
    chamber           chamber DEFAULT 'senate',
    senat_profile_url TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (name, first_name)
);

CREATE INDEX IF NOT EXISTS politicians_party_idx ON politicians(party_id);

-- ============================================================
-- laws
-- ============================================================
CREATE TABLE IF NOT EXISTS laws (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,   -- e.g. L95/2026
    title       TEXT NOT NULL,
    scraped_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- votes  (one row = one plenary vote session for a law)
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    law_id           UUID REFERENCES laws(id) ON DELETE CASCADE,
    vote_date        DATE NOT NULL,
    vote_type        TEXT,              -- e.g. "vot final", "vot preliminar"
    present_count    INTEGER,
    for_count        INTEGER,
    against_count    INTEGER,
    abstention_count INTEGER,
    not_voted_count  INTEGER,
    senat_app_id     TEXT UNIQUE,       -- AppID UUID from senat.ro URL (dedup key)
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (law_id, vote_date, vote_type)
);

CREATE INDEX IF NOT EXISTS votes_law_idx  ON votes(law_id);
CREATE INDEX IF NOT EXISTS votes_date_idx ON votes(vote_date);

-- ============================================================
-- politician_votes
-- ============================================================
CREATE TABLE IF NOT EXISTS politician_votes (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id        UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    vote_id              UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    vote_choice          vote_choice NOT NULL,
    -- true if this senator voted differently from their party's majority on this vote
    party_line_deviation BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (politician_id, vote_id)
);

CREATE INDEX IF NOT EXISTS pv_politician_idx ON politician_votes(politician_id);
CREATE INDEX IF NOT EXISTS pv_vote_idx       ON politician_votes(vote_id);
CREATE INDEX IF NOT EXISTS pv_deviation_idx  ON politician_votes(party_line_deviation) WHERE party_line_deviation = TRUE;

-- ============================================================
-- Convenience view: vote results with party aggregates
-- ============================================================
CREATE OR REPLACE VIEW party_vote_summary WITH (security_invoker = true) AS
SELECT
    pv.vote_id,
    p.abbreviation  AS party,
    pv.vote_choice,
    COUNT(*)        AS senator_count
FROM politician_votes pv
JOIN politicians pol ON pol.id = pv.politician_id
JOIN parties     p   ON p.id  = pol.party_id
GROUP BY pv.vote_id, p.abbreviation, pv.vote_choice;

-- ============================================================
-- Convenience view: deviations per vote with law info
-- ============================================================
CREATE OR REPLACE VIEW deviations WITH (security_invoker = true) AS
SELECT
    l.code          AS law_code,
    v.vote_date,
    pol.name        AS senator_name,
    pol.first_name  AS senator_first_name,
    pa.abbreviation AS party,
    pv.vote_choice,
    pv.party_line_deviation
FROM politician_votes pv
JOIN politicians pol ON pol.id = pv.politician_id
JOIN parties     pa  ON pa.id  = pol.party_id
JOIN votes       v   ON v.id   = pv.vote_id
JOIN laws        l   ON l.id   = v.law_id
WHERE pv.party_line_deviation = TRUE;
