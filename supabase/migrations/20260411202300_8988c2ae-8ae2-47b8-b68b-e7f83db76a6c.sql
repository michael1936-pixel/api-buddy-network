
CREATE TABLE public.optimization_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  current_stage integer NOT NULL DEFAULT 0,
  total_stages integer NOT NULL DEFAULT 0,
  current_combo integer NOT NULL DEFAULT 0,
  total_combos integer NOT NULL DEFAULT 0,
  best_train double precision,
  best_test double precision,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.optimization_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_full_optimization_runs"
  ON public.optimization_runs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
