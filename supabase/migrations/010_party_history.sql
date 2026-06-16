-- Migration 010: politician_party_history
-- Tracks party membership over time to surface party switches on politician profiles.

CREATE TABLE politician_party_history (
    id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    politician_id uuid        REFERENCES politicians(id) ON DELETE CASCADE NOT NULL,
    party_id      uuid        REFERENCES parties(id) NOT NULL,
    from_date     date        NOT NULL,
    to_date       date,
    created_at    timestamptz DEFAULT now()
);

-- At most one open (current) entry per politician
CREATE UNIQUE INDEX politician_party_history_open
    ON politician_party_history (politician_id)
    WHERE to_date IS NULL;

CREATE INDEX ON politician_party_history (politician_id, from_date);

GRANT SELECT ON politician_party_history TO anon;
