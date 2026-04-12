
-- Auto-update updated_at on optimization_runs whenever a row is modified
CREATE OR REPLACE FUNCTION public.update_optimization_runs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_optimization_runs_updated_at
  BEFORE UPDATE ON public.optimization_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_optimization_runs_updated_at();
