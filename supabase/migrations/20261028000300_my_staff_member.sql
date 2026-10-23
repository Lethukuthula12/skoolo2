-- A teacher needs their own staff_member id to add a calendar item, but the staff register is
-- admin-only, so they cannot read it. This SECURITY DEFINER function returns only the caller's own
-- staff_member id at a given school (or null), leaking nothing about anyone else.
create or replace function public.my_staff_member(p_school_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select sm.id from public.staff_members sm
  where sm.school_id = p_school_id and sm.user_id = auth.uid()
  limit 1;
$$;
