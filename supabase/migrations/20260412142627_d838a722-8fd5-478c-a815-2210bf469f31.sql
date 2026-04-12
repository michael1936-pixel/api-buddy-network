CREATE TABLE public.optimization_trades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  optimization_result_id bigint NOT NULL,
  symbol text NOT NULL,
  direction text NOT NULL DEFAULT 'long',
  entry_time timestamptz NOT NULL,
  entry_price double precision NOT NULL,
  exit_time timestamptz,
  exit_price double precision,
  pnl_pct double precision DEFAULT 0,
  exit_reason text,
  strategy text,
  bars_held integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.optimization_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_full_optimization_trades"
ON public.optimization_trades
FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE INDEX idx_optimization_trades_result_id ON public.optimization_trades(optimization_result_id);
CREATE INDEX idx_optimization_trades_symbol ON public.optimization_trades(symbol);