-- The timetable and calendar policies need to ask "is this staff record the signed-in user's own?"
-- The staff register is admin-only, so a teacher cannot answer that with an inline subquery against
-- staff_members (RLS hides every row from them). This SECURITY DEFINER helper answers it safely,
-- filtered to the caller, the same way teaches_class and class_school_id do.

create or replace function public.is_my_staff_member(p_staff_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_members sm
    where sm.id = p_staff_member_id and sm.user_id = auth.uid()
  );
$$;

-- Repoint the two teacher-facing policies onto the helper.
drop policy if exists "teachers see own lessons" on public.timetable_lessons;
create policy "teachers see own lessons" on public.timetable_lessons for select
  using (public.is_my_staff_member(teacher_id));

drop policy if exists "teachers manage own calendar" on public.calendar_items;
create policy "teachers manage own calendar" on public.calendar_items for all
  using (public.is_my_staff_member(staff_member_id))
  with check (public.is_my_staff_member(staff_member_id));
