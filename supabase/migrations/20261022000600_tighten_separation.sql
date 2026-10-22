-- Tighten tenant and role separation.
--
-- 1) Application counts are admin-only (teachers have no enrolment access, aggregate included).
-- 2) Grade availability counts applications through a SECURITY DEFINER function, so the number is
--    accurate and identical for everyone (anonymous, parent, admin) and never depends on the
--    caller's row security over the applications table. The function returns only a count, never a
--    row, so it leaks nothing about who applied.

create or replace function public.school_application_counts(p_school_id uuid)
returns table (status public.application_status, payment_status public.payment_status, total int)
language sql stable security definer set search_path = public as $$
  select a.status, a.payment_status, count(*)::int
  from public.applications a
  where a.school_id = p_school_id and public.is_school_admin(p_school_id)
  group by a.status, a.payment_status;
$$;

create or replace function public.period_grade_taken(p_period_grade_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.applications a
  where a.period_grade_id = p_period_grade_id and a.status not in ('declined', 'withdrawn');
$$;

create or replace view public.period_grade_availability
with (security_invoker = true) as
select
  pg.id, pg.period_id, pg.grade_code, g.label as grade_label, g.sort_order, pg.is_open, pg.capacity,
  public.period_grade_taken(pg.id) as places_taken,
  case when pg.capacity is null then null
       else greatest(pg.capacity - public.period_grade_taken(pg.id), 0)
  end as places_left,
  (pg.is_open and (pg.capacity is null or pg.capacity > public.period_grade_taken(pg.id))) as is_available
from public.period_grades pg
join public.grades g on g.code = pg.grade_code;
