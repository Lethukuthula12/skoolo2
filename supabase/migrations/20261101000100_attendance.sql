-- Daily attendance register: the class's record of who was present each day. This is the teacher's
-- affirmative register, separate from the parent-reported absences of Stage 4. One record per learner
-- per day; the class's teachers and the school's admins take and read it (staff-only for now).

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present' check (status in ('present', 'absent', 'late')),
  note text,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, attendance_date)
);
create index attendance_class_date_idx on public.attendance_records (class_id, attendance_date);
alter table public.attendance_records enable row level security;
create trigger attendance_set_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- Fill school_id from the class, stamp who marked it, and keep the learner inside the class.
create or replace function public.attendance_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  select school_id into v_school from public.classes where id = new.class_id;
  if v_school is null then
    raise exception 'Unknown class' using hint = 'BAD_CLASS';
  end if;
  if not exists (select 1 from public.learners l where l.id = new.learner_id and l.current_class_id = new.class_id) then
    raise exception 'That learner is not in this class' using hint = 'NOT_IN_CLASS';
  end if;
  new.school_id := v_school;
  new.marked_by := auth.uid();
  return new;
end $$;
create trigger attendance_fill_trigger before insert or update on public.attendance_records
  for each row execute function public.attendance_fill();

-- The class's teachers and the school's admins take and read the register; nobody else sees it.
create policy "staff take class attendance" on public.attendance_records for all
  using (public.can_edit_class_reports(class_id))
  with check (public.can_edit_class_reports(class_id));
