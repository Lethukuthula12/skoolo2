-- The calendar becomes one shared school calendar. Any staff member (admin, principal or teacher)
-- adds events to it and every staff member sees them; connected parents see the parent-visible ones
-- in their app. Each event records who added it. This replaces the old teacher-owned calendar.

-- A creator and a parent-visibility flag; the staff link is now optional (admins have no staff row).
alter table public.calendar_items
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists created_by_name text,
  add column if not exists parent_visible boolean not null default true;
alter table public.calendar_items alter column staff_member_id drop not null;

-- Rework the fill trigger: the client sets school_id (its current school); we stamp the author and
-- keep any class/subject link inside that school.
create or replace function public.calendar_item_fill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_name := (select full_name from public.profiles where id = auth.uid());
  end if;
  if new.school_id is null then
    raise exception 'A school is required' using hint = 'NO_SCHOOL';
  end if;
  if new.class_id is not null and not exists (
    select 1 from public.classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'That class is not at this school' using hint = 'BAD_CLASS';
  end if;
  if new.subject_id is not null and not exists (
    select 1 from public.subjects s where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'That subject is not at this school' using hint = 'BAD_SUBJECT';
  end if;
  return new;
end $$;

-- Is the signed-in user a parent connected to a learner at this school?
create or replace function public.parent_at_school(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learners l
    where l.school_id = p_school_id and (
      l.parent_id = auth.uid()
      or exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.user_id = auth.uid())
    )
  );
$$;

-- Replace the old teacher-owned policies with the shared-calendar ones.
drop policy if exists "teachers manage own calendar" on public.calendar_items;
drop policy if exists "admins see school calendar" on public.calendar_items;

-- Any staff member reads the whole school calendar and adds to it.
create policy "staff read school calendar" on public.calendar_items for select
  using (public.is_school_staff(school_id));
create policy "staff add school events" on public.calendar_items for insert
  with check (public.is_school_staff(school_id));
-- The author, or any admin, may change or remove an event.
create policy "author or admin edits events" on public.calendar_items for update
  using (created_by = auth.uid() or public.is_school_admin(school_id))
  with check (created_by = auth.uid() or public.is_school_admin(school_id));
create policy "author or admin deletes events" on public.calendar_items for delete
  using (created_by = auth.uid() or public.is_school_admin(school_id));
-- Connected parents read the parent-visible events for their child's school.
create policy "parents read school calendar" on public.calendar_items for select
  using (parent_visible and public.parent_at_school(school_id));
