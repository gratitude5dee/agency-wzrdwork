ALTER TABLE public.heartbeat_runs
  DROP CONSTRAINT IF EXISTS heartbeat_runs_status_check;

ALTER TABLE public.heartbeat_runs
  ADD CONSTRAINT heartbeat_runs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timed_out', 'cancelled'));
