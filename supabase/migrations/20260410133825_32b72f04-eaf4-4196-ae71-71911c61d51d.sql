ALTER TABLE public.news_events
  ADD COLUMN IF NOT EXISTS ai_analysis text,
  ADD COLUMN IF NOT EXISTS ai_sentiment_score numeric,
  ADD COLUMN IF NOT EXISTS predicted_spy_impact text,
  ADD COLUMN IF NOT EXISTS predicted_vix_impact text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;