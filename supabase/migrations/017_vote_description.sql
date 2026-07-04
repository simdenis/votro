-- Law-less plenary votes (procedural, or subject without a recognizable law
-- code) rendered as "—" on the site: both scrapers extract the vote subject
-- from the source page but only persisted it through `laws`. Keep it on the
-- vote itself so every vote has displayable text.
alter table votes add column if not exists description text;
