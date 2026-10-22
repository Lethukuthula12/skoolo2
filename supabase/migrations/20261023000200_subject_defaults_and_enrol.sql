-- CAPS subject defaults offered to a school (the admin runs this once, then edits), and the
-- function that places an accepted applicant into a class and the register.

-- Offer the standard CAPS subjects for every grade in the school's range. Idempotent. The admin
-- edits or adds subjects afterwards; FET grades (10-12) are elective and left for the admin.
create or replace function public.seed_default_subjects(p_school_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_school_admin(p_school_id) then
    raise exception 'Not an administrator of this school' using errcode = 'P0001', hint = 'NOT_ADMIN';
  end if;

  with phase_subjects as (
    select g.code as grade_code, s.name, s.language_level, s.sort_order
    from (values ('G00'), ('G0'), ('GRR'), ('GR')) g(code)
    cross join (values
      ('Home Language', 'home', 1), ('Mathematics', null, 2), ('Life Skills', null, 3)
    ) s(name, language_level, sort_order)
    union all
    select g.code, s.name, s.language_level, s.sort_order
    from (values ('G1'), ('G2'), ('G3')) g(code)
    cross join (values
      ('Home Language', 'home', 1), ('First Additional Language', 'first_additional', 2),
      ('Mathematics', null, 3), ('Life Skills', null, 4)
    ) s(name, language_level, sort_order)
    union all
    select g.code, s.name, s.language_level, s.sort_order
    from (values ('G4'), ('G5'), ('G6')) g(code)
    cross join (values
      ('Home Language', 'home', 1), ('First Additional Language', 'first_additional', 2),
      ('Mathematics', null, 3), ('Natural Sciences and Technology', null, 4),
      ('Social Sciences', null, 5), ('Life Skills', null, 6)
    ) s(name, language_level, sort_order)
    union all
    select g.code, s.name, s.language_level, s.sort_order
    from (values ('G7'), ('G8'), ('G9')) g(code)
    cross join (values
      ('Home Language', 'home', 1), ('First Additional Language', 'first_additional', 2),
      ('Mathematics', null, 3), ('Natural Sciences', null, 4), ('Social Sciences', null, 5),
      ('Technology', null, 6), ('Economic and Management Sciences', null, 7),
      ('Life Orientation', null, 8), ('Creative Arts', null, 9)
    ) s(name, language_level, sort_order)
  )
  insert into public.subjects (school_id, grade_code, name, language_level, sort_order)
  select p_school_id, ps.grade_code, ps.name, ps.language_level, ps.sort_order
  from phase_subjects ps
  join public.grades g on g.code = ps.grade_code
  join public.schools sc on sc.id = p_school_id
  left join public.grades lo on lo.code = sc.lowest_grade
  left join public.grades hi on hi.code = sc.highest_grade
  where g.sort_order between coalesce(lo.sort_order, 0) and coalesce(hi.sort_order, 99)
  on conflict (school_id, grade_code, name) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Place an accepted applicant into a class: links the learner to the school and class, and marks
-- the application accepted (which sends the parent the acceptance message via the status trigger).
create or replace function public.enrol_application(p_application_id uuid, p_class_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_app public.applications; v_class public.classes;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found or not public.is_school_admin(v_app.school_id) then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  select * into v_class from public.classes where id = p_class_id;
  if not found or v_class.school_id <> v_app.school_id then
    raise exception 'That class is not at this school' using errcode = 'P0001', hint = 'CLASS_MISMATCH';
  end if;

  update public.learners
  set school_id = v_app.school_id, current_class_id = p_class_id
  where id = v_app.learner_id;

  update public.applications
  set status = 'accepted'
  where id = p_application_id and status not in ('declined', 'withdrawn', 'accepted');
end $$;
