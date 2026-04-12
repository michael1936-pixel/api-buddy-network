
CREATE TABLE public.optimization_run_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL,
  symbol text,
  stage_number integer,
  stage_name text,
  round_number integer,
  current_combo integer,
  total_combos integer,
  heap_used_mb numeric,
  heap_total_mb numeric,
  combination_cache_size integer,
  indicator_cache_size integer,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_opt_run_logs_run_id ON public.optimization_run_logs(run_id);
CREATE INDEX idx_opt_run_logs_created_at ON public.optimization_run_logs(created_at);

ALTER TABLE public.optimization_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_full_optimization_run_logs"
ON public.optimization_run_logs
FOR ALL
TO public
USING (true)
WITH CHECK (true);
