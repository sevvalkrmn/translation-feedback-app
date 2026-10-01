create or replace function public.create_student_session(
  p_first_name text,
  p_last_name text,
  p_access_token_hash text
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  status text,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with inserted as (
    insert into public.student_sessions (
      first_name,
      last_name,
      access_token_hash,
      status
    )
    values (
      trim(p_first_name),
      trim(p_last_name),
      p_access_token_hash,
      'active'
    )
    returning
      student_sessions.id,
      student_sessions.first_name,
      student_sessions.last_name,
      student_sessions.status,
      student_sessions.created_at,
      student_sessions.completed_at
  )
  select
    inserted.id,
    inserted.first_name,
    inserted.last_name,
    inserted.status,
    inserted.created_at,
    inserted.completed_at
  from inserted;
end;
$$;

create or replace function public.verify_student_session_access(
  p_session_id uuid,
  p_access_token_hash text
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  status text,
  created_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    sessions.id,
    sessions.first_name,
    sessions.last_name,
    sessions.status,
    sessions.created_at,
    sessions.completed_at
  from public.student_sessions sessions
  where sessions.id = p_session_id
    and sessions.access_token_hash = p_access_token_hash
  limit 1;
$$;

create or replace function public.list_session_tasks(
  p_session_id uuid,
  p_access_token_hash text
)
returns table (
  id uuid,
  session_id uuid,
  task_number integer,
  method text,
  source_text text,
  initial_translation text,
  revised_translation text,
  status text,
  created_at timestamptz,
  submitted_at timestamptz,
  revised_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    tasks.id,
    tasks.session_id,
    tasks.task_number,
    tasks.method,
    tasks.source_text,
    tasks.initial_translation,
    tasks.revised_translation,
    tasks.status,
    tasks.created_at,
    tasks.submitted_at,
    tasks.revised_at
  from public.translation_tasks tasks
  where tasks.session_id = p_session_id
    and exists (
      select 1
      from public.student_sessions sessions
      where sessions.id = p_session_id
        and sessions.access_token_hash = p_access_token_hash
    )
  order by tasks.task_number asc;
$$;

create or replace function public.get_session_task_bundle(
  p_session_id uuid,
  p_access_token_hash text,
  p_task_number integer
)
returns table (
  task jsonb,
  feedback jsonb,
  job jsonb
)
language sql
security definer
set search_path = public
as $$
  with selected_task as (
    select
      tasks.id,
      tasks.session_id,
      tasks.task_number,
      tasks.method,
      tasks.source_text,
      tasks.initial_translation,
      tasks.revised_translation,
      tasks.status,
      tasks.created_at,
      tasks.submitted_at,
      tasks.revised_at
    from public.translation_tasks tasks
    where tasks.session_id = p_session_id
      and tasks.task_number = p_task_number
      and p_task_number in (1, 2)
      and exists (
        select 1
        from public.student_sessions sessions
        where sessions.id = p_session_id
          and sessions.access_token_hash = p_access_token_hash
      )
    limit 1
  )
  select
    jsonb_build_object(
      'id', selected_task.id,
      'session_id', selected_task.session_id,
      'task_number', selected_task.task_number,
      'method', selected_task.method,
      'source_text', selected_task.source_text,
      'initial_translation', selected_task.initial_translation,
      'revised_translation', selected_task.revised_translation,
      'status', selected_task.status,
      'created_at', selected_task.created_at,
      'submitted_at', selected_task.submitted_at,
      'revised_at', selected_task.revised_at
    ) as task,
    (
      select jsonb_build_object(
        'id', feedbacks.id,
        'task_id', feedbacks.task_id,
        'feedback_type', feedbacks.feedback_type,
        'model_name', feedbacks.model_name,
        'structured_output', feedbacks.structured_output,
        'raw_output', feedbacks.raw_output,
        'created_at', feedbacks.created_at
      )
      from public.feedbacks feedbacks
      where feedbacks.task_id = selected_task.id
      order by feedbacks.created_at desc
      limit 1
    ) as feedback,
    (
      select jsonb_build_object(
        'status', jobs.status
      )
      from public.model_jobs jobs
      where jobs.task_id = selected_task.id
      order by jobs.created_at desc
      limit 1
    ) as job
  from selected_task;
$$;

create or replace function public.submit_session_translation_task(
  p_session_id uuid,
  p_access_token_hash text,
  p_task_number integer,
  p_source_text text,
  p_initial_translation text
)
returns table (
  id uuid,
  session_id uuid,
  task_number integer,
  method text,
  source_text text,
  initial_translation text,
  revised_translation text,
  status text,
  created_at timestamptz,
  submitted_at timestamptz,
  revised_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
  v_job_type text;
begin
  if p_task_number not in (1, 2) then
    raise exception 'invalid task number';
  end if;

  if not exists (
    select 1
    from public.student_sessions sessions
    where sessions.id = p_session_id
      and sessions.access_token_hash = p_access_token_hash
      and sessions.status = 'active'
  ) then
    raise exception 'session not found or inactive';
  end if;

  if p_task_number = 2 and not exists (
    select 1
    from public.translation_tasks tasks
    where tasks.session_id = p_session_id
      and tasks.task_number = 1
      and tasks.status = 'revised'
  ) then
    raise exception 'task 1 must be revised before task 2';
  end if;

  v_method := case when p_task_number = 1 then 'llm' else 'xai' end;
  v_job_type := case when p_task_number = 1 then 'llm_feedback' else 'xai_feedback' end;

  return query
  with inserted_task as (
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
    returning
      translation_tasks.id,
      translation_tasks.session_id,
      translation_tasks.task_number,
      translation_tasks.method,
      translation_tasks.source_text,
      translation_tasks.initial_translation,
      translation_tasks.revised_translation,
      translation_tasks.status,
      translation_tasks.created_at,
      translation_tasks.submitted_at,
      translation_tasks.revised_at
  ), inserted_job as (
    insert into public.model_jobs (task_id, job_type, status)
    select inserted_task.id, v_job_type, 'queued'
    from inserted_task
  )
  select
    inserted_task.id,
    inserted_task.session_id,
    inserted_task.task_number,
    inserted_task.method,
    inserted_task.source_text,
    inserted_task.initial_translation,
    inserted_task.revised_translation,
    inserted_task.status,
    inserted_task.created_at,
    inserted_task.submitted_at,
    inserted_task.revised_at
  from inserted_task;
end;
$$;

create or replace function public.submit_session_task_revision(
  p_session_id uuid,
  p_access_token_hash text,
  p_task_number integer,
  p_revised_translation text
)
returns table (
  id uuid,
  session_id uuid,
  task_number integer,
  method text,
  source_text text,
  initial_translation text,
  revised_translation text,
  status text,
  created_at timestamptz,
  submitted_at timestamptz,
  revised_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  if p_task_number not in (1, 2) then
    raise exception 'invalid task number';
  end if;

  if char_length(trim(coalesce(p_revised_translation, ''))) = 0 then
    raise exception 'revision cannot be empty';
  end if;

  return query
  with updated_task as (
    update public.translation_tasks tasks
    set
      revised_translation = trim(p_revised_translation),
      status = 'revised',
      revised_at = now()
    where tasks.session_id = p_session_id
      and tasks.task_number = p_task_number
      and tasks.status = 'feedback_ready'
      and tasks.revised_translation is null
      and exists (
        select 1
        from public.student_sessions sessions
        where sessions.id = p_session_id
          and sessions.access_token_hash = p_access_token_hash
          and sessions.status = 'active'
      )
    returning
      tasks.id,
      tasks.session_id,
      tasks.task_number,
      tasks.method,
      tasks.source_text,
      tasks.initial_translation,
      tasks.revised_translation,
      tasks.status,
      tasks.created_at,
      tasks.submitted_at,
      tasks.revised_at
  )
  select
    updated_task.id,
    updated_task.session_id,
    updated_task.task_number,
    updated_task.method,
    updated_task.source_text,
    updated_task.initial_translation,
    updated_task.revised_translation,
    updated_task.status,
    updated_task.created_at,
    updated_task.submitted_at,
    updated_task.revised_at
  from updated_task;

  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    raise exception 'revision cannot be saved';
  end if;

  if exists (
    select 1
    from public.translation_tasks tasks
    where tasks.session_id = p_session_id
      and tasks.task_number = 1
      and tasks.status = 'revised'
  ) and exists (
    select 1
    from public.translation_tasks tasks
    where tasks.session_id = p_session_id
      and tasks.task_number = 2
      and tasks.status = 'revised'
  ) then
    update public.student_sessions sessions
    set
      status = 'completed',
      completed_at = coalesce(sessions.completed_at, now())
    where sessions.id = p_session_id
      and sessions.access_token_hash = p_access_token_hash
      and sessions.status = 'active';
  end if;
end;
$$;

create or replace function public.retry_failed_session_job(
  p_session_id uuid,
  p_access_token_hash text,
  p_task_number integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  if p_task_number not in (1, 2) then
    raise exception 'invalid task number';
  end if;

  with target_job as (
    select jobs.id
    from public.model_jobs jobs
    join public.translation_tasks tasks on tasks.id = jobs.task_id
    where tasks.session_id = p_session_id
      and tasks.task_number = p_task_number
      and jobs.status = 'failed'
      and exists (
        select 1
        from public.student_sessions sessions
        where sessions.id = p_session_id
          and sessions.access_token_hash = p_access_token_hash
          and sessions.status = 'active'
      )
    order by jobs.created_at desc
    limit 1
  )
  update public.model_jobs jobs
  set
    status = 'queued',
    attempt_count = 0,
    locked_by = null,
    lease_expires_at = null,
    last_error = null,
    started_at = null,
    completed_at = null
  where jobs.id in (select target_job.id from target_job);

  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    raise exception 'retryable failed job not found';
  end if;
end;
$$;

create or replace function public.get_session_result_bundle(
  p_session_id uuid,
  p_access_token_hash text
)
returns table (
  session jsonb,
  task1 jsonb,
  task2 jsonb,
  feedback1 jsonb,
  feedback2 jsonb
)
language sql
security definer
set search_path = public
as $$
  with authorized_session as (
    select
      sessions.id,
      sessions.first_name,
      sessions.last_name,
      sessions.status,
      sessions.created_at,
      sessions.completed_at
    from public.student_sessions sessions
    where sessions.id = p_session_id
      and sessions.access_token_hash = p_access_token_hash
    limit 1
  ), task_one as (
    select
      tasks.id,
      tasks.session_id,
      tasks.task_number,
      tasks.method,
      tasks.source_text,
      tasks.initial_translation,
      tasks.revised_translation,
      tasks.status,
      tasks.created_at,
      tasks.submitted_at,
      tasks.revised_at
    from public.translation_tasks tasks
    where tasks.session_id = p_session_id
      and tasks.task_number = 1
      and tasks.status = 'revised'
      and tasks.revised_translation is not null
    limit 1
  ), task_two as (
    select
      tasks.id,
      tasks.session_id,
      tasks.task_number,
      tasks.method,
      tasks.source_text,
      tasks.initial_translation,
      tasks.revised_translation,
      tasks.status,
      tasks.created_at,
      tasks.submitted_at,
      tasks.revised_at
    from public.translation_tasks tasks
    where tasks.session_id = p_session_id
      and tasks.task_number = 2
      and tasks.status = 'revised'
      and tasks.revised_translation is not null
    limit 1
  ), feedback_one as (
    select
      feedbacks.id,
      feedbacks.task_id,
      feedbacks.feedback_type,
      feedbacks.model_name,
      feedbacks.structured_output,
      feedbacks.raw_output,
      feedbacks.created_at
    from public.feedbacks feedbacks
    join task_one on task_one.id = feedbacks.task_id
    order by feedbacks.created_at desc
    limit 1
  ), feedback_two as (
    select
      feedbacks.id,
      feedbacks.task_id,
      feedbacks.feedback_type,
      feedbacks.model_name,
      feedbacks.structured_output,
      feedbacks.raw_output,
      feedbacks.created_at
    from public.feedbacks feedbacks
    join task_two on task_two.id = feedbacks.task_id
    order by feedbacks.created_at desc
    limit 1
  )
  select
    jsonb_build_object(
      'id', authorized_session.id,
      'first_name', authorized_session.first_name,
      'last_name', authorized_session.last_name,
      'status', authorized_session.status,
      'created_at', authorized_session.created_at,
      'completed_at', authorized_session.completed_at
    ) as session,
    jsonb_build_object(
      'id', task_one.id,
      'session_id', task_one.session_id,
      'task_number', task_one.task_number,
      'method', task_one.method,
      'source_text', task_one.source_text,
      'initial_translation', task_one.initial_translation,
      'revised_translation', task_one.revised_translation,
      'status', task_one.status,
      'created_at', task_one.created_at,
      'submitted_at', task_one.submitted_at,
      'revised_at', task_one.revised_at
    ) as task1,
    jsonb_build_object(
      'id', task_two.id,
      'session_id', task_two.session_id,
      'task_number', task_two.task_number,
      'method', task_two.method,
      'source_text', task_two.source_text,
      'initial_translation', task_two.initial_translation,
      'revised_translation', task_two.revised_translation,
      'status', task_two.status,
      'created_at', task_two.created_at,
      'submitted_at', task_two.submitted_at,
      'revised_at', task_two.revised_at
    ) as task2,
    jsonb_build_object(
      'id', feedback_one.id,
      'task_id', feedback_one.task_id,
      'feedback_type', feedback_one.feedback_type,
      'model_name', feedback_one.model_name,
      'structured_output', feedback_one.structured_output,
      'raw_output', feedback_one.raw_output,
      'created_at', feedback_one.created_at
    ) as feedback1,
    jsonb_build_object(
      'id', feedback_two.id,
      'task_id', feedback_two.task_id,
      'feedback_type', feedback_two.feedback_type,
      'model_name', feedback_two.model_name,
      'structured_output', feedback_two.structured_output,
      'raw_output', feedback_two.raw_output,
      'created_at', feedback_two.created_at
    ) as feedback2
  from authorized_session
  join task_one on true
  join task_two on true
  join feedback_one on true
  join feedback_two on true;
$$;

revoke execute on function public.create_student_session(text, text, text) from public, anon, authenticated;
revoke execute on function public.verify_student_session_access(uuid, text) from public, anon, authenticated;
revoke execute on function public.list_session_tasks(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_session_task_bundle(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.submit_session_translation_task(uuid, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.submit_session_task_revision(uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.retry_failed_session_job(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.get_session_result_bundle(uuid, text) from public, anon, authenticated;

grant execute on function public.create_student_session(text, text, text) to service_role;
grant execute on function public.verify_student_session_access(uuid, text) to service_role;
grant execute on function public.list_session_tasks(uuid, text) to service_role;
grant execute on function public.get_session_task_bundle(uuid, text, integer) to service_role;
grant execute on function public.submit_session_translation_task(uuid, text, integer, text, text) to service_role;
grant execute on function public.submit_session_task_revision(uuid, text, integer, text) to service_role;
grant execute on function public.retry_failed_session_job(uuid, text, integer) to service_role;
grant execute on function public.get_session_result_bundle(uuid, text) to service_role;
