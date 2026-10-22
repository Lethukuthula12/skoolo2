-- Expose the school's second contact number in the public directory view.
create or replace view public.school_directory
with (security_invoker = true) as
select
  s.id, s.slug, s.name, s.badge_url, s.tagline, s.description, s.town, s.province,
  s.street_address, s.phone, s.email, s.website, s.lowest_grade, s.highest_grade,
  s.is_verified, s.is_claimed,
  ep.id as open_period_id, ep.academic_year as open_academic_year, ep.fee_amount, ep.currency,
  ep.opens_at, ep.closes_at,
  (s.is_claimed and ep.id is not null) as is_open_for_registration,
  s.secondary_phone
from public.schools s
left join public.enrolment_periods ep on ep.school_id = s.id and ep.status = 'open';
