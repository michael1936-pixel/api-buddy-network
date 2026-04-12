ALTER TABLE public.optimization_runs 
  ALTER COLUMN current_combo TYPE bigint,
  ALTER COLUMN total_combos TYPE bigint;

ALTER TABLE public.optimization_run_logs
  ALTER COLUMN current_combo TYPE bigint,
  ALTER COLUMN total_combos TYPE bigint,
  ALTER COLUMN combination_cache_size TYPE bigint,
  ALTER COLUMN indicator_cache_size TYPE bigint;