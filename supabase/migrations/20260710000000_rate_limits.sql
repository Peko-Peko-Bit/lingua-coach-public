-- Rate limiting for AI routes (fixed window, counted per user per bucket).
-- Accessed exclusively via check_rate_limit() with the service_role key;
-- RLS is enabled with no policies so anon/authenticated roles have no access.

create table if not exists public.rate_limits (
  user_id      uuid        not null,
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_user_id        uuid,
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
  v_retry_after  integer;
begin
  -- Fixed window aligned to epoch so all instances agree on the boundary
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Drop all expired-window rows (keeps the table small without a separate
  -- cron job; scoping this to the caller would leave deleted guests' rows
  -- behind forever)
  delete from public.rate_limits
  where window_start < v_window_start;

  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (p_user_id, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  v_retry_after := ceil(
    extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now()))
  );

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'retry_after', greatest(v_retry_after, 1)
  );
end;
$$;

-- service_role only: revoke from everyone else
revoke all on function public.check_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
