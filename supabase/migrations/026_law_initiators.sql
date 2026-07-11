-- Who proposed each law: initiator type on laws + nominal initiators table.
-- Source: senat.ro project fisa (lista.aspx?nr_cls=L{n}&an_cls={year}),
-- parsed by scraper/initiator_scraper.py.

ALTER TABLE laws
  ADD COLUMN IF NOT EXISTS initiator_type text
    CHECK (initiator_type IN ('guvern', 'parlamentari', 'cetateni')),
  ADD COLUMN IF NOT EXISTS initiators_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS law_initiators (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id        uuid NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  politician_id uuid REFERENCES politicians(id) ON DELETE SET NULL,
  -- raw fisa strings survive unmatched names (ex-members, typos)
  name_raw      text NOT NULL,
  role_raw      text,   -- 'senator' | 'deputat'
  party_raw     text,   -- party abbreviation as printed on the fisa
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (law_id, name_raw)
);

CREATE INDEX IF NOT EXISTS law_initiators_law_idx ON law_initiators(law_id);
CREATE INDEX IF NOT EXISTS law_initiators_politician_idx ON law_initiators(politician_id);

ALTER TABLE law_initiators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS law_initiators_anon_read ON law_initiators;
CREATE POLICY law_initiators_anon_read ON law_initiators FOR SELECT USING (true);
