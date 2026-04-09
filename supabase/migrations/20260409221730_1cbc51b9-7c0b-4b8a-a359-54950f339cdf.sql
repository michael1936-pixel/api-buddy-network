
-- 1. Market Data (OHLCV)
CREATE TABLE IF NOT EXISTS public.market_data (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL DEFAULT '15min',
  timestamp TIMESTAMPTZ NOT NULL,
  open DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low DOUBLE PRECISION NOT NULL,
  close DOUBLE PRECISION NOT NULL,
  volume BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, interval, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_market_data_lookup ON public.market_data(symbol, interval, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_interval ON public.market_data(symbol, interval, timestamp DESC);

-- 2. Tracked Symbols
CREATE TABLE IF NOT EXISTS public.tracked_symbols (
  symbol TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT true,
  last_download TIMESTAMPTZ,
  total_bars INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Signals Log
CREATE TABLE IF NOT EXISTS public.signals (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  direction TEXT NOT NULL,
  strategy TEXT NOT NULL,
  action TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  rsi DOUBLE PRECISION,
  atr DOUBLE PRECISION,
  reason TEXT,
  webhook_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signals_lookup ON public.signals(symbol, timestamp DESC);

-- 4. Positions
CREATE TABLE IF NOT EXISTS public.positions (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  entry_time TIMESTAMPTZ DEFAULT NOW(),
  exit_price DOUBLE PRECISION,
  exit_time TIMESTAMPTZ,
  pnl_pct DOUBLE PRECISION,
  strategy TEXT NOT NULL,
  stop_price DOUBLE PRECISION,
  trail_price DOUBLE PRECISION,
  tp_price DOUBLE PRECISION,
  be_triggered BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_positions_lookup ON public.positions(symbol, status);

-- 5. Optimization Results
CREATE TABLE IF NOT EXISTS public.optimization_results (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  parameters JSONB NOT NULL,
  train_return DOUBLE PRECISION,
  test_return DOUBLE PRECISION,
  total_trades INT DEFAULT 0,
  win_rate DOUBLE PRECISION DEFAULT 0,
  max_drawdown DOUBLE PRECISION DEFAULT 0,
  sharpe_ratio DOUBLE PRECISION DEFAULT 0,
  overfit_risk TEXT,
  agent_decision TEXT,
  agent_confidence DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT true,
  optimized_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_optim_lookup ON public.optimization_results(symbol, is_active);

-- 6. Download Jobs
CREATE TABLE IF NOT EXISTS public.data_download_jobs (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bars_downloaded INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Agent Logs
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  strategy TEXT NOT NULL,
  direction TEXT NOT NULL,
  pnl_pct DOUBLE PRECISION,
  murphy_score INT,
  rules_passed TEXT[],
  rules_failed TEXT[],
  claude_decision TEXT,
  is_win BOOLEAN,
  agent_weights JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_logs_lookup ON public.agent_logs(symbol, timestamp DESC);

-- 8. News Events
CREATE TABLE IF NOT EXISTS public.news_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  headline TEXT NOT NULL,
  source TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  impact_level TEXT NOT NULL,
  sentiment TEXT,
  affected_sectors TEXT[],
  affected_symbols TEXT[],
  summary TEXT,
  confidence INT,
  timestamp TIMESTAMPTZ NOT NULL,
  reaction_recorded BOOLEAN DEFAULT false,
  actual_spy_1h DOUBLE PRECISION,
  actual_spy_1d DOUBLE PRECISION,
  actual_vix_change DOUBLE PRECISION,
  symbol_reactions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_events_time ON public.news_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_category ON public.news_events(category, impact_level);

-- 9. Knowledge Learning
CREATE TABLE IF NOT EXISTS public.knowledge_learning (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  strategy TEXT NOT NULL,
  direction TEXT NOT NULL,
  pnl_pct DOUBLE PRECISION,
  exit_reason TEXT,
  principles_applied TEXT[],
  principles_violated TEXT[],
  is_win BOOLEAN,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_time ON public.knowledge_learning(timestamp DESC);

-- 10. Timeframe Profiles
CREATE TABLE IF NOT EXISTS public.timeframe_profiles (
  symbol TEXT PRIMARY KEY,
  best_timeframe TEXT NOT NULL,
  all_results JSONB,
  reason TEXT,
  volatility_profile TEXT,
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Agent Memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  agent_id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  version INT DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Trade Summaries
CREATE TABLE IF NOT EXISTS public.trade_summaries (
  period TEXT PRIMARY KEY,
  summary JSONB NOT NULL,
  trade_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Learning Snapshots
CREATE TABLE IF NOT EXISTS public.learning_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. S&P 500 Symbols
CREATE TABLE IF NOT EXISTS public.sp500_symbols (
  symbol TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT true,
  sector TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  removed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sp500_active ON public.sp500_symbols(is_active) WHERE is_active = true;

-- 15. Agent Feedback
CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  strategy TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  pnl_pct NUMERIC NOT NULL,
  is_win BOOLEAN NOT NULL,
  exit_reason TEXT,
  vix_at_entry NUMERIC,
  vix_regime TEXT,
  news_risk TEXT,
  agent_snapshots JSONB NOT NULL DEFAULT '[]',
  final_verdict TEXT NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_symbol ON public.agent_feedback(symbol);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_close_time ON public.agent_feedback(close_time DESC);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_is_win ON public.agent_feedback(is_win);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_strategy ON public.agent_feedback(strategy);

-- 16. AI Insights
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  reasoning TEXT,
  agent_lessons JSONB DEFAULT '[]',
  pattern JSONB,
  market_insight TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON public.ai_insights(type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON public.ai_insights(created_at DESC);

-- ═══ RLS Policies ═══
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_download_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeframe_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp500_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Service role full access (server uses service key)
-- Anon role read access (dashboard uses anon key)
CREATE POLICY "service_full_market_data" ON public.market_data FOR ALL USING (true);
CREATE POLICY "service_full_tracked_symbols" ON public.tracked_symbols FOR ALL USING (true);
CREATE POLICY "service_full_signals" ON public.signals FOR ALL USING (true);
CREATE POLICY "service_full_positions" ON public.positions FOR ALL USING (true);
CREATE POLICY "service_full_optimization" ON public.optimization_results FOR ALL USING (true);
CREATE POLICY "service_full_download_jobs" ON public.data_download_jobs FOR ALL USING (true);
CREATE POLICY "service_full_agent_logs" ON public.agent_logs FOR ALL USING (true);
CREATE POLICY "service_full_news_events" ON public.news_events FOR ALL USING (true);
CREATE POLICY "service_full_knowledge" ON public.knowledge_learning FOR ALL USING (true);
CREATE POLICY "service_full_timeframe" ON public.timeframe_profiles FOR ALL USING (true);
CREATE POLICY "service_full_agent_memory" ON public.agent_memory FOR ALL USING (true);
CREATE POLICY "service_full_trade_summaries" ON public.trade_summaries FOR ALL USING (true);
CREATE POLICY "service_full_learning_snapshots" ON public.learning_snapshots FOR ALL USING (true);
CREATE POLICY "service_full_sp500" ON public.sp500_symbols FOR ALL USING (true);
CREATE POLICY "service_full_agent_feedback" ON public.agent_feedback FOR ALL USING (true);
CREATE POLICY "service_full_ai_insights" ON public.ai_insights FOR ALL USING (true);
