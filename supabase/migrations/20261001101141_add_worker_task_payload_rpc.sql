create or replace function public.get_claimed_job_task_payload(
  p_job_id uuid,
  p_worker_id text
)
returns table (
  id uuid,
  task_number integer,
  method text,
  source_text text,
  initial_translation text
)
language sql
security definer
set search_path = public
as $$
  select
    tasks.id,
    tasks.task_number,
    tasks.method,
    tasks.source_text,
    tasks.initial_translation
  from public.model_jobs jobs
  join public.translation_tasks tasks on tasks.id = jobs.task_id
  where jobs.id = p_job_id
    and jobs.status = 'processing'
    and jobs.locked_by = p_worker_id
    and jobs.lease_expires_at > now()
  limit 1;
$$;

revoke execute on function public.get_claimed_job_task_payload(uuid, text) from public, anon, authenticated;

grant execute on function public.get_claimed_job_task_payload(uuid, text) to service_role;
