create extension if not exists pgcrypto;

create table public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  access_token_hash text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.translation_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.student_sessions(id) on delete cascade,
  task_number integer not null check (task_number in (1, 2)),
  method text not null check (method in ('llm', 'xai')),
  source_text text not null check (char_length(trim(source_text)) > 0),
  initial_translation text not null check (char_length(trim(initial_translation)) > 0),
  revised_translation text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'feedback_ready', 'revised')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  revised_at timestamptz,
  constraint translation_tasks_one_per_number unique (session_id, task_number),
  constraint translation_tasks_method_matches_number check (
    (task_number = 1 and method = 'llm') or (task_number = 2 and method = 'xai')
  ),
  constraint translation_tasks_revision_requires_revised_status check (
    (revised_translation is null and status <> 'revised') or
    (revised_translation is not null and status = 'revised')
  )
);

create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.translation_tasks(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('llm_feedback', 'xai_feedback')),
  model_name text not null,
  structured_output jsonb not null,
  raw_output jsonb,
  created_at timestamptz not null default now(),
  constraint feedback_type_matches_task unique (task_id, feedback_type)
);

create table public.model_jobs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.translation_tasks(id) on delete cascade,
  job_type text not null check (job_type in ('llm_feedback', 'xai_feedback')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  locked_by text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint model_jobs_one_type_per_task unique (task_id, job_type)
);

create index student_sessions_status_idx on public.student_sessions(status);
create index translation_tasks_session_idx on public.translation_tasks(session_id, task_number);
create index translation_tasks_status_idx on public.translation_tasks(status);
create index feedbacks_task_idx on public.feedbacks(task_id);
create index model_jobs_status_created_idx on public.model_jobs(status, created_at);
create index model_jobs_lease_idx on public.model_jobs(lease_expires_at) where status = 'processing';

alter table public.student_sessions enable row level security;
alter table public.translation_tasks enable row level security;
alter table public.feedbacks enable row level security;
alter table public.model_jobs enable row level security;

revoke all on public.student_sessions from anon, authenticated;
revoke all on public.translation_tasks from anon, authenticated;
revoke all on public.feedbacks from anon, authenticated;
revoke all on public.model_jobs from anon, authenticated;

create or replace function public.submit_translation_task(
  p_session_id uuid,
  p_task_number integer,
  p_source_text text,
  p_initial_translation text
)
returns public.translation_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
  v_job_type text;
  v_task public.translation_tasks;
begin
  if p_task_number not in (1, 2) then
    raise exception 'invalid task number';
  end if;

  if not exists (
    select 1 from public.student_sessions
    where id = p_session_id and status = 'active'
  ) then
    raise exception 'session not found or inactive';
  end if;

  if p_task_number = 2 and not exists (
    select 1 from public.translation_tasks
    where session_id = p_session_id and task_number = 1 and status = 'revised'
  ) then
    raise exception 'task 1 must be revised before task 2';
  end if;

  v_method := case when p_task_number = 1 then 'llm' else 'xai' end;
  v_job_type := case when p_task_number = 1 then 'llm_feedback' else 'xai_feedback' end;

  insert into public.translation_tasks (
    session_id,
    task_number,
    method,
    source_text,
    initial_translation,
    status,
    submitted_at
  )
  values (
    p_session_id,
    p_task_number,
    v_method,
    trim(p_source_text),
    trim(p_initial_translation),
    'submitted',
    now()
  )
  returning * into v_task;

  insert into public.model_jobs (task_id, job_type, status)
  values (v_task.id, v_job_type, 'queued');

  return v_task;
end;
$$;

create or replace function public.claim_next_model_job(
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns setof public.model_jobs
language sql
security definer
set search_path = public
as $$
  with candidate as (
    select id
    from public.model_jobs
    where
      status = 'queued'
      or (status = 'processing' and lease_expires_at < now())
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.model_jobs jobs
  set
    status = 'processing',
    locked_by = p_worker_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = jobs.attempt_count + 1,
    started_at = coalesce(jobs.started_at, now()),
    last_error = null
  from candidate
  where jobs.id = candidate.id
  returning jobs.*;
$$;

create or replace function public.complete_model_job(
  p_job_id uuid,
  p_worker_id text,
  p_model_name text,
  p_structured_output jsonb,
  p_raw_output jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.model_jobs;
begin
  select * into v_job
  from public.model_jobs
  where id = p_job_id and status = 'processing' and locked_by = p_worker_id
  for update;

  if not found then
    raise exception 'job is not locked by this worker';
  end if;

  insert into public.feedbacks (
    task_id,
    feedback_type,
    model_name,
    structured_output,
    raw_output
  )
  values (
    v_job.task_id,
    v_job.job_type,
    p_model_name,
    p_structured_output,
    p_raw_output
  )
  on conflict (task_id, feedback_type)
  do update set
    model_name = excluded.model_name,
    structured_output = excluded.structured_output,
    raw_output = excluded.raw_output,
    created_at = now();

  update public.translation_tasks
  set status = 'feedback_ready'
  where id = v_job.task_id and status = 'submitted';

  update public.model_jobs
  set
    status = 'succeeded',
    lease_expires_at = null,
    completed_at = now(),
    last_error = null
  where id = v_job.id;
end;
$$;

create or replace function public.fail_model_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.model_jobs;
begin
  select * into v_job
  from public.model_jobs
  where id = p_job_id and status = 'processing' and locked_by = p_worker_id
  for update;

  if not found then
    raise exception 'job is not locked by this worker';
  end if;

  update public.model_jobs
  set
    status = case when v_job.attempt_count < v_job.max_attempts then 'queued' else 'failed' end,
    locked_by = null,
    lease_expires_at = null,
    completed_at = case when v_job.attempt_count < v_job.max_attempts then null else now() end,
    last_error = left(coalesce(p_error, 'unknown error'), 500)
  where id = v_job.id;
end;
$$;

revoke execute on function public.submit_translation_task(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.claim_next_model_job(text, integer) from public, anon, authenticated;
revoke execute on function public.complete_model_job(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_model_job(uuid, text, text) from public, anon, authenticated;

grant execute on function public.submit_translation_task(uuid, integer, text, text) to service_role;
grant execute on function public.claim_next_model_job(text, integer) to service_role;
grant execute on function public.complete_model_job(uuid, text, text, jsonb, jsonb) to service_role;
grant execute on function public.fail_model_job(uuid, text, text) to service_role;
