-- inmotu — venue enrichment. Perplexity fills disciplines/website/season for
-- each venue; venues auto-link to curated tracks (and thereby events) by
-- geo-proximity. These columns hold the enrichment + provenance.

ALTER TABLE venues ADD COLUMN ai_summary TEXT;      -- one-line description
ALTER TABLE venues ADD COLUMN season TEXT;          -- e.g. "April–October"
ALTER TABLE venues ADD COLUMN enriched_at INTEGER;  -- last Perplexity enrich
