    -- 054: structured two-part summaries — describe and attribute, don't characterize.
    -- laws.summary stays the neutral "ce face" one-liner (every list/caption/OG card
    -- reads it); motivare_initiatori holds the sponsors' stated justification, quoted
    -- from the expunere de motive and explicitly framed as their claim. summary_source
    -- records what the model actually read, so the frontend can label thin summaries
    -- structurally instead of trusting prose:
    --   'em+text' — expunere de motive + bill-text PDF (senat.ro …FG.PDF)
    --   'em'      — expunere only (FG fetch failed)
    --   'text'    — bill text only (no EM; also pending_bills' pl* PDFs)
    --   'title'   — neither document readable, summary derived from the title alone
    -- Filled by scraper/gemini_summarizer.py (laws) / pending_bills_scorer.py.

    ALTER TABLE laws
      ADD COLUMN IF NOT EXISTS motivare_initiatori text,
      ADD COLUMN IF NOT EXISTS bill_pdf_url        text,
      ADD COLUMN IF NOT EXISTS summary_source      text
        CHECK (summary_source IN ('em+text', 'em', 'text', 'title'));

    COMMENT ON COLUMN laws.motivare_initiatori IS
      'AI: initiators'' stated justification, quoted from the expunere de motive, framed as their claim';
    COMMENT ON COLUMN laws.bill_pdf_url IS
      'senat.ro bill-text PDF (forma inițiatorului, …FG.PDF)';
    COMMENT ON COLUMN laws.summary_source IS
      'what the summary model actually read: em+text | em | text | title';

    ALTER TABLE pending_bills
      ADD COLUMN IF NOT EXISTS motivare_initiatori text,
      ADD COLUMN IF NOT EXISTS summary_source      text
        CHECK (summary_source IN ('em+text', 'em', 'text', 'title'));

    -- ── law_status: recreated verbatim from 022 + the three new columns ────
    drop view if exists public.law_status;
    create view public.law_status with (security_invoker = true) as
    with ranked as (
      select *,
        row_number() over (
          partition by law_id, chamber
          order by
            case
              when lower(coalesce(vote_type, '')) like '%final%' then 0
              when lower(coalesce(vote_type, ''))
                   ~ '(amendament|retrimitere|procedur|ordinea de zi|prelungire)' then 2
              else 1
            end,
            vote_date desc
        ) as rn
      from votes
      where law_id is not null
    )
    select
      l.id               as law_id,
      l.code,
      l.title,
      l.law_category,
      l.summary,
      l.summary_is_ai,
      l.motivare_initiatori,
      l.summary_source,
      l.em_url,
      l.bill_pdf_url,
      l.presidential_status,
      l.presidential_date,
      l.ccr_decision,
      l.ccr_date,
      s.id               as senate_vote_id,
      s.vote_date        as senate_vote_date,
      s.outcome          as senate_outcome,
      s.for_count        as senate_for,
      s.against_count    as senate_against,
      s.abstention_count as senate_abstentions,
      c.id               as camera_vote_id,
      c.vote_date        as camera_vote_date,
      c.outcome          as camera_outcome,
      c.for_count        as camera_for,
      c.against_count    as camera_against,
      c.abstention_count as camera_abstentions,
      case
        when l.presidential_status = 'promulgat'   then 'promulgat'
        when l.presidential_status = 'retrimis'    then 'retrimis'
        when l.presidential_status = 'sesizat_ccr' then 'sesizat_ccr'
        when s.id is not null and c.id is not null then 'complet'
        when s.id is not null and c.id is null     then 'asteapta_camera'
        when s.id is null     and c.id is not null then 'asteapta_senat'
        else 'necunoscut'
      end as status
    from laws l
    inner join (select distinct law_id from votes where law_id is not null) lv on lv.law_id = l.id
    left join ranked s on s.law_id = l.id and s.chamber = 'senate'   and s.rn = 1
    left join ranked c on c.law_id = l.id and c.chamber = 'deputies' and c.rn = 1;

    grant select on public.law_status to anon;
