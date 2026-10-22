-- Grade 0 sits between Grade 00 and Grade RR (pilot school's structure: 00, 0, RR, R, 1-7).
update public.grades set sort_order = sort_order + 100 where sort_order >= 1;
insert into public.grades (code, label, sort_order) values ('G0', 'Grade 0', 1) on conflict (code) do nothing;
update public.grades set sort_order = sort_order - 99 where sort_order >= 101;

-- Legal identity of the school (for receipts and claims later) and a second contact number.
alter table public.schools
  add column if not exists legal_name text,
  add column if not exists company_registration text,
  add column if not exists npo_registration text,
  add column if not exists tax_reference text,
  add column if not exists secondary_phone text;

-- The applying parent or guardian, captured per application. The school needs the ID number
-- and relationship, not only the account holder's contact details.
alter table public.applications
  add column if not exists guardian_full_name text not null default '',
  add column if not exists guardian_relationship text not null default '',
  add column if not exists guardian_identity_number text,
  add column if not exists guardian_phone text not null default '';

-- Staff register: people who work at the school, with or without a login.
create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  position text not null default '',
  class_assigned text,
  identity_number text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_members_school_idx on public.staff_members (school_id, last_name, first_name);
alter table public.staff_members enable row level security;
drop trigger if exists staff_members_set_updated_at on public.staff_members;
create trigger staff_members_set_updated_at before update on public.staff_members
  for each row execute function public.set_updated_at();
drop policy if exists "staff manage own staff register" on public.staff_members;
create policy "staff manage own staff register" on public.staff_members for all
  using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));
