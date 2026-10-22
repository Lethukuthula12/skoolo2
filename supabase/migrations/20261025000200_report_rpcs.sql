-- Stage 3 write path. All report changes go through these functions, which enforce who may act
-- and the draft -> approved -> published flow. Teachers of a class and the school's admins capture
-- marks while a report is draft; only admins approve and publish.

-- May the caller work on this class's reports (capture marks)?
create or replace function public.can_edit_class_reports(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_school_admin(public.class_school_id(p_class_id)) or public.teaches_class(p_class_id);
$$;

-- Create draft report cards and empty marks for every learner in a class for a term. Idempotent.
create or replace function public.ensure_term_reports(p_class_id uuid, p_term int)
returns int language plpgsql security definer set search_path = public as $$
declare v_class public.classes; v_count int := 0; v_learner record; v_report uuid;
begin
  if not public.can_edit_class_reports(p_class_id) then
    raise exception 'You cannot capture results for this class' using errcode = 'P0001', hint = 'NOT_ALLOWED';
  end if;
  select * into v_class from public.classes where id = p_class_id;
  if not found then raise exception 'Class not found' using errcode = 'P0002'; end if;

  for v_learner in select id from public.learners where current_class_id = p_class_id loop
    insert into public.report_cards (school_id, class_id, learner_id, academic_year, term_number)
    values (v_class.school_id, p_class_id, v_learner.id, v_class.academic_year, p_term)
    on conflict (learner_id, academic_year, term_number) do nothing;

    select id into v_report from public.report_cards
      where learner_id = v_learner.id and academic_year = v_class.academic_year and term_number = p_term;

    insert into public.report_marks (report_card_id, subject_id)
    select v_report, s.id from public.subjects s
    where s.school_id = v_class.school_id and s.grade_code = v_class.grade_code
    on conflict (report_card_id, subject_id) do nothing;

    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.save_mark(p_report_card_id uuid, p_subject_id uuid, p_mark numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_rc public.report_cards;
begin
  select * into v_rc from public.report_cards where id = p_report_card_id;
  if not found or not public.can_edit_class_reports(v_rc.class_id) then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_rc.status <> 'draft' then
    raise exception 'This report has been approved and can no longer be edited' using errcode = 'P0001', hint = 'NOT_DRAFT';
  end if;
  insert into public.report_marks (report_card_id, subject_id, mark)
  values (p_report_card_id, p_subject_id, p_mark)
  on conflict (report_card_id, subject_id) do update set mark = excluded.mark;
end $$;

create or replace function public.set_report_meta(p_report_card_id uuid, p_days_absent int, p_teacher_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rc public.report_cards;
begin
  select * into v_rc from public.report_cards where id = p_report_card_id;
  if not found or not public.can_edit_class_reports(v_rc.class_id) then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_rc.status <> 'draft' then
    raise exception 'This report has been approved and can no longer be edited' using errcode = 'P0001', hint = 'NOT_DRAFT';
  end if;
  update public.report_cards
  set days_absent = p_days_absent, teacher_comment = p_teacher_comment
  where id = p_report_card_id;
end $$;

-- Principal (an admin) approves a class's term reports.
create or replace function public.approve_class_reports(p_class_id uuid, p_term int)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_school_admin(public.class_school_id(p_class_id)) then
    raise exception 'Only an administrator can approve reports' using errcode = 'P0001', hint = 'NOT_ADMIN';
  end if;
  update public.report_cards
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where class_id = p_class_id and term_number = p_term and status = 'draft';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Publish approved reports to connected parents and notify them.
create or replace function public.publish_class_reports(p_class_id uuid, p_term int)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_rc record; v_school text; v_learner text; v_recipient uuid;
begin
  if not public.is_school_admin(public.class_school_id(p_class_id)) then
    raise exception 'Only an administrator can publish reports' using errcode = 'P0001', hint = 'NOT_ADMIN';
  end if;
  select name into v_school from public.schools where id = public.class_school_id(p_class_id);

  for v_rc in
    select * from public.report_cards
    where class_id = p_class_id and term_number = p_term and status = 'approved'
  loop
    update public.report_cards set status = 'published', published_at = now() where id = v_rc.id;
    select first_name || ' ' || last_name into v_learner from public.learners where id = v_rc.learner_id;

    for v_recipient in
      select l.parent_id from public.learners l where l.id = v_rc.learner_id and l.parent_id is not null
      union
      select g.user_id from public.learner_guardians g where g.learner_id = v_rc.learner_id and g.user_id is not null
    loop
      insert into public.messages (recipient_id, school_id, subject, body)
      values (v_recipient, v_rc.school_id,
        format('%s''s Term %s report', v_learner, p_term),
        format('%s has published %s''s Term %s report. Open "My children" in the app to view it.', v_school, v_learner, p_term));
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
