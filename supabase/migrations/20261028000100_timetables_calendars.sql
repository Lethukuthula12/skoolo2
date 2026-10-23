-- Stage 6: teacher weekly timetables and dated calendar items.
--
-- The school's admin sets the day structure once (periods and breaks). Each teacher then places
-- their own lessons into (weekday, period) slots, but only for the classes and subjects they are
-- assigned in Stage 1. A teacher cannot be in two places at once, and a class cannot hold two
-- lessons at once: both are enforced by unique constraints, so a clash is refused, not just drawn.
-- Teachers also keep dated items (tests, assignments, outings). The admin oversees every teacher's
-- timetable and a timetable per class. Everything is school-owned with RLS.

-- ---------------------------------------------------------------------------
-- The school day: an ordered list of periods, some of them breaks.
-- ---------------------------------------------------------------------------
create table public.school_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  position int not null check (position >= 0),
  name text not null check (length(trim(name)) > 0),
  starts_at time not null,
  ends_at time not null,
  is_break boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, position),
  check (ends_at > starts_at)
);
create index school_periods_school_idx on public.school_periods (school_id, position);
alter table public.school_periods enable row level security;
create trigger school_periods_set_updated_at before update on public.school_periods
  for each row execute function public.set_updated_at();
create policy "admins manage school periods" on public.school_periods for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "staff see school periods" on public.school_periods for select
  using (public.is_school_staff(school_id));

-- ---------------------------------------------------------------------------
-- Timetable lessons: one class+subject taught by one teacher in one (weekday, period) slot.
-- ---------------------------------------------------------------------------
create table public.timetable_lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year int not null check (academic_year between 2020 and 2100),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  teacher_id uuid not null references public.staff_members (id) on delete cascade,
  period_id uuid not null references public.school_periods (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),  -- 1 = Monday (ISO)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a class is in exactly one place per slot; a teacher teaches exactly one lesson per slot
  unique (class_id, day_of_week, period_id),
  unique (teacher_id, day_of_week, period_id)
);
create index timetable_lessons_school_year_idx on public.timetable_lessons (school_id, academic_year);
create index timetable_lessons_teacher_idx on public.timetable_lessons (teacher_id);
create index timetable_lessons_class_idx on public.timetable_lessons (class_id);
alter table public.timetable_lessons enable row level security;
create trigger timetable_lessons_set_updated_at before update on public.timetable_lessons
  for each row execute function public.set_updated_at();

-- Admins oversee and may fix their school's whole timetable.
create policy "admins manage timetable" on public.timetable_lessons for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
-- A teacher reads only their own lessons; they write through place_lesson / remove_lesson.
create policy "teachers see own lessons" on public.timetable_lessons for select
  using (exists (select 1 from public.staff_members sm where sm.id = teacher_id and sm.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Place a lesson for the signed-in teacher. Validates that they teach this class+subject, that the
-- period and subject belong to the class's school and grade, and lets the unique constraints refuse
-- a clash with a friendly hint. Returns the new lesson id.
-- ---------------------------------------------------------------------------
create or replace function public.place_lesson(
  p_class_id uuid, p_subject_id uuid, p_period_id uuid, p_day_of_week int
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_school_id uuid;
  v_year int;
  v_grade text;
  v_grade_order int;
  v_threshold_order int;
  v_staff_id uuid;
  v_lesson_id uuid;
begin
  select c.school_id, c.academic_year, c.grade_code into v_school_id, v_year, v_grade
  from public.classes c where c.id = p_class_id;
  if v_school_id is null then
    raise exception 'Class not found' using hint = 'NOT_FOUND';
  end if;

  -- the caller's staff record at this school
  select sm.id into v_staff_id from public.staff_members sm
  where sm.school_id = v_school_id and sm.user_id = auth.uid();
  if v_staff_id is null then
    raise exception 'You are not a teacher at this school' using hint = 'NOT_STAFF';
  end if;

  -- the subject must belong to this school and the class's grade
  if not exists (select 1 from public.subjects s
                 where s.id = p_subject_id and s.school_id = v_school_id and s.grade_code = v_grade) then
    raise exception 'That subject is not offered in this grade' using hint = 'BAD_SUBJECT';
  end if;

  -- the period must belong to this school and not be a break
  if not exists (select 1 from public.school_periods sp
                 where sp.id = p_period_id and sp.school_id = v_school_id and not sp.is_break) then
    raise exception 'That period cannot hold a lesson' using hint = 'BAD_PERIOD';
  end if;

  if p_day_of_week < 1 or p_day_of_week > 7 then
    raise exception 'Invalid day' using hint = 'BAD_DAY';
  end if;

  -- class-teacher grade or subject-teacher grade?
  select g.sort_order into v_grade_order from public.grades g where g.code = v_grade;
  select g.sort_order into v_threshold_order from public.grades g
    join public.schools sc on sc.id = v_school_id
    where g.code = sc.subject_teaching_from_grade;

  if v_grade_order < coalesce(v_threshold_order, 999) then
    -- class-teacher grade: the caller must be the class teacher; any subject of the grade is allowed
    if not exists (select 1 from public.classes c where c.id = p_class_id and c.class_teacher_id = v_staff_id) then
      raise exception 'Only the class teacher sets this class''s timetable' using hint = 'NOT_YOUR_CLASS';
    end if;
  else
    -- subject-teacher grade: the caller must be the assigned subject teacher for this class+subject
    if not exists (select 1 from public.class_subject_teachers cst
                   where cst.class_id = p_class_id and cst.subject_id = p_subject_id and cst.teacher_id = v_staff_id) then
      raise exception 'You are not the teacher for this subject in this class' using hint = 'NOT_YOUR_SUBJECT';
    end if;
  end if;

  insert into public.timetable_lessons (school_id, academic_year, class_id, subject_id, teacher_id, period_id, day_of_week)
  values (v_school_id, v_year, p_class_id, p_subject_id, v_staff_id, p_period_id, p_day_of_week)
  returning id into v_lesson_id;
  return v_lesson_id;
exception
  when unique_violation then
    if exists (select 1 from public.timetable_lessons t
               where t.teacher_id = v_staff_id and t.day_of_week = p_day_of_week and t.period_id = p_period_id) then
      raise exception 'You already teach a lesson in that slot' using hint = 'TEACHER_BUSY';
    else
      raise exception 'That class already has a lesson in that slot' using hint = 'CLASS_BUSY';
    end if;
end;
$$;

-- Remove one of the signed-in teacher's own lessons.
create or replace function public.remove_lesson(p_lesson_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_staff uuid;
begin
  select teacher_id into v_staff from public.timetable_lessons where id = p_lesson_id;
  if v_staff is null then return; end if;
  if not exists (select 1 from public.staff_members sm where sm.id = v_staff and sm.user_id = auth.uid()) then
    raise exception 'You can only remove your own lessons' using hint = 'NOT_YOURS';
  end if;
  delete from public.timetable_lessons where id = p_lesson_id;
end;
$$;

-- The signed-in teacher's week, joined with class, subject and period, for a year.
create or replace function public.my_timetable(p_year int)
returns table (
  id uuid, day_of_week int, period_id uuid, period_name text, starts_at time, ends_at time,
  period_position int, class_id uuid, class_name text, grade_code text, subject_id uuid, subject_name text
) language sql stable security definer set search_path = public as $$
  select t.id, t.day_of_week, sp.id, sp.name, sp.starts_at, sp.ends_at, sp.position,
         c.id, c.name, c.grade_code, s.id, s.name
  from public.timetable_lessons t
  join public.staff_members sm on sm.id = t.teacher_id
  join public.school_periods sp on sp.id = t.period_id
  join public.classes c on c.id = t.class_id
  join public.subjects s on s.id = t.subject_id
  where sm.user_id = auth.uid() and t.academic_year = p_year
  order by t.day_of_week, sp.position;
$$;

-- ---------------------------------------------------------------------------
-- Calendar items: a teacher's dated items (tests, assignments, outings, events).
-- ---------------------------------------------------------------------------
create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'event' check (kind in ('test', 'assignment', 'outing', 'event', 'other')),
  event_date date not null,
  starts_at time,
  ends_at time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create index calendar_items_staff_date_idx on public.calendar_items (staff_member_id, event_date);
create index calendar_items_school_date_idx on public.calendar_items (school_id, event_date);
alter table public.calendar_items enable row level security;
create trigger calendar_items_set_updated_at before update on public.calendar_items
  for each row execute function public.set_updated_at();

-- Derive school_id from the owning staff member, and keep any class/subject link within that school.
create or replace function public.calendar_item_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  select school_id into v_school from public.staff_members where id = new.staff_member_id;
  if v_school is null then
    raise exception 'Unknown staff member' using hint = 'NOT_STAFF';
  end if;
  new.school_id := v_school;
  if new.class_id is not null and not exists (
    select 1 from public.classes c where c.id = new.class_id and c.school_id = v_school) then
    raise exception 'That class is not at your school' using hint = 'BAD_CLASS';
  end if;
  if new.subject_id is not null and not exists (
    select 1 from public.subjects s where s.id = new.subject_id and s.school_id = v_school) then
    raise exception 'That subject is not at your school' using hint = 'BAD_SUBJECT';
  end if;
  return new;
end;
$$;
create trigger calendar_items_fill before insert or update on public.calendar_items
  for each row execute function public.calendar_item_fill();

-- A teacher keeps their own items; the admin oversees the school's.
create policy "teachers manage own calendar" on public.calendar_items for all
  using (exists (select 1 from public.staff_members sm where sm.id = staff_member_id and sm.user_id = auth.uid()))
  with check (exists (select 1 from public.staff_members sm where sm.id = staff_member_id and sm.user_id = auth.uid()));
create policy "admins see school calendar" on public.calendar_items for select
  using (public.is_school_admin(school_id));
