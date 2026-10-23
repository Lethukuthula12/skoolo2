-- Per-school portal theme. Each school's admin picks the portal's colours (self-service, like every
-- other school-specific detail); their staff see the result. Stored on the school row, so the
-- existing RLS applies unchanged: admins update their own school, staff read it, and no school can
-- see or change another's. The shape is small and open-ended, e.g.
--   { "primary": "#3a41c4", "header": "#3a41c4", "sidebar": "#22223d" }
alter table public.schools add column if not exists theme jsonb;
