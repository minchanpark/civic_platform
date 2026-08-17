create or replace function private.review_recurrence(target_issue_id uuid, target_approved boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  candidate private.recurrence_candidates%rowtype;
  current_spot_id uuid;
  previous_field_status private.field_status;
  reporter uuid;
  should_count_for_urgency boolean;
begin
  if target_approved is null then
    raise exception using errcode = '22004', message = 'Recurrence decision is required';
  end if;
  select * into candidate from private.recurrence_candidates
  where issue_id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Recurrence candidate is unavailable';
  end if;
  if candidate.status <> 'pending' then
    if (candidate.status = 'approved') is distinct from target_approved then
      raise exception using errcode = '23505', message = 'Recurrence already has a different decision';
    end if;
    return private.issue_detail(target_issue_id);
  end if;

  select reporter_id into reporter from public.issues where id = target_issue_id;
  should_count_for_urgency := target_approved and not exists (
    select 1
    from private.recurrence_candidates as prior
    join public.issues as prior_issue on prior_issue.id = prior.issue_id
    where prior.candidate_problem_spot_id = candidate.candidate_problem_spot_id
      and prior.status = 'approved'
      and prior_issue.reporter_id = reporter
      and prior.decided_at > now() - interval '24 hours'
  );

  update private.recurrence_candidates
  set status = case when target_approved
        then 'approved'::private.recurrence_review_status
        else 'rejected'::private.recurrence_review_status
      end,
      decided_by = actor_id,
      decided_at = now(),
      counts_for_urgency = should_count_for_urgency
  where issue_id = target_issue_id;

  if target_approved then
    select problem_spot_id into current_spot_id
    from private.issue_problem_spots where issue_id = target_issue_id for update;
    select field_status into previous_field_status
    from private.problem_spots where id = candidate.candidate_problem_spot_id for update;

    update private.issue_problem_spots
    set problem_spot_id = candidate.candidate_problem_spot_id, linked_at = now()
    where issue_id = target_issue_id;

    update private.problem_spots
    set field_status = 'recurrence_confirmed', updated_at = now()
    where id = candidate.candidate_problem_spot_id;

    insert into private.field_status_events(
      problem_spot_id, issue_id, from_status, to_status, reason, changed_by
    ) values (
      candidate.candidate_problem_spot_id, target_issue_id, previous_field_status,
      'recurrence_confirmed', 'recurrence_approved', actor_id
    );

    delete from private.problem_spots
    where id = current_spot_id
      and not exists (
        select 1 from private.issue_problem_spots where problem_spot_id = current_spot_id
      );
  end if;

  return private.issue_detail(target_issue_id);
end;
$$;
