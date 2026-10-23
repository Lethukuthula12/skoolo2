-- Notice board: school-wide announcements posted by the school's admins (principal, clerk), read by
-- staff and connected parents according to each notice's audience. One-to-many broadcasts, separate
-- from the one-to-one messages of Stage 4.

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  audience text not null default 'all' check (audience in ('all', 'staff', 'parents')),
  pinned boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notices_school_idx on public.notices (school_id, pinned desc, created_at desc);
alter table public.notices enable row level security;
create trigger notices_set_updated_at before update on public.notices
  for each row execute function public.set_updated_at();

-- Stamp the author on insert.
create or replace function public.notice_fill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_name := (select full_name from public.profiles where id = auth.uid());
  end if;
  return new;
end $$;
create trigger notices_fill before insert or update on public.notices
  for each row execute function public.notice_fill();

-- Admins post and manage their school's notices.
create policy "admins manage notices" on public.notices for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
-- Staff read the notices meant for everyone or for staff.
create policy "staff read notices" on public.notices for select
  using (public.is_school_staff(school_id) and audience in ('all', 'staff'));
-- Connected parents read the notices meant for everyone or for parents.
create policy "parents read notices" on public.notices for select
  using (public.parent_at_school(school_id) and audience in ('all', 'parents'));
