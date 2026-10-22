-- Self-service for schools: roles, staff invites by code, school registration and claiming,
-- badge uploads, staff documents. Skoolo's only manual step left is verifying a new school.

-- ---------------------------------------------------------------------------
-- Roles: admin (principal, clerk) can change things; staff (teachers) can read.
-- ---------------------------------------------------------------------------
alter table public.school_staff drop constraint if exists school_staff_role_check;
alter table public.school_staff add constraint school_staff_role_check check (role in ('admin', 'staff'));

create or replace function public.is_school_admin(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.school_staff s
    where s.school_id = p_school_id and s.user_id = auth.uid() and s.role = 'admin'
  );
$$;

-- Admins manage their own school's staff list (the RPCs below do the inserts).
drop policy if exists "admins remove staff" on public.school_staff;
create policy "admins remove staff" on public.school_staff for delete
  using (public.is_school_admin(school_id) and user_id <> auth.uid());
drop policy if exists "admins change roles" on public.school_staff;
create policy "admins change roles" on public.school_staff for update
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- Writes that used to be open to any staff member are now admin-only.
drop policy if exists "staff update own school" on public.schools;
create policy "admins update own school" on public.schools for update
  using (public.is_school_admin(id)) with check (public.is_school_admin(id));

drop policy if exists "staff manage own bank account" on public.school_bank_accounts;
create policy "admins manage own bank account" on public.school_bank_accounts for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

drop policy if exists "staff manage own periods" on public.enrolment_periods;
create policy "admins manage own periods" on public.enrolment_periods for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

drop policy if exists "staff manage own period grades" on public.period_grades;
create policy "admins manage own period grades" on public.period_grades for all
  using (public.is_school_admin(public.period_school_id(period_id)))
  with check (public.is_school_admin(public.period_school_id(period_id)));

drop policy if exists "staff manage own staff register" on public.staff_members;
create policy "admins manage own staff register" on public.staff_members for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

drop policy if exists "staff update school applications" on public.applications;
create policy "admins update school applications" on public.applications for update
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create or replace function public.confirm_application_payment(p_application_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found or not public.is_school_admin(v_app.school_id) then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.payment_status = 'confirmed' then
    return;
  end if;
  update public.applications
  set payment_status = 'confirmed',
      payment_confirmed_at = now(),
      payment_confirmed_by = auth.uid(),
      staff_note = coalesce(p_note, staff_note),
      status = case when status in ('declined', 'withdrawn', 'accepted') then status else 'accepted' end
  where id = p_application_id;
end $$;

create or replace function public.set_application_status(
  p_application_id uuid, p_status public.application_status, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found or not public.is_school_admin(v_app.school_id) then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  update public.applications
  set status = p_status, staff_note = p_note
  where id = p_application_id;
end $$;

-- ---------------------------------------------------------------------------
-- Staff invites: the admin creates a code, shares it (WhatsApp, in person), the staff member
-- signs up with the same email and redeems it. No email sending, no service role needed.
-- ---------------------------------------------------------------------------
alter table public.staff_members add column if not exists user_id uuid references public.profiles (id) on delete set null;

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_member_id uuid references public.staff_members (id) on delete set null,
  email text not null,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  code text not null unique,
  created_by uuid references public.profiles (id),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists staff_invites_school_idx on public.staff_invites (school_id, created_at desc);
alter table public.staff_invites enable row level security;
drop policy if exists "admins manage invites" on public.staff_invites;
create policy "admins manage invites" on public.staff_invites for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create or replace function public.generate_invite_code()
returns text language plpgsql as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.staff_invites where code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public.staff_invites_before_insert()
returns trigger language plpgsql as $$
begin
  new.code := coalesce(nullif(new.code, ''), public.generate_invite_code());
  new.email := lower(trim(new.email));
  new.created_by := auth.uid();
  return new;
end $$;
drop trigger if exists staff_invites_before_insert on public.staff_invites;
create trigger staff_invites_before_insert before insert on public.staff_invites
  for each row execute function public.staff_invites_before_insert();

-- Redeem a code. The caller must be signed in with the email the invite was made for.
create or replace function public.accept_staff_invite(p_code text)
returns public.schools language plpgsql security definer set search_path = public as $$
declare
  v_invite public.staff_invites;
  v_school public.schools;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = 'P0001', hint = 'NOT_SIGNED_IN';
  end if;
  select * into v_invite from public.staff_invites where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'That invite code was not found' using errcode = 'P0002', hint = 'INVITE_NOT_FOUND';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'That invite has already been used' using errcode = 'P0001', hint = 'INVITE_USED';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'That invite has expired. Ask your school for a new one' using errcode = 'P0001', hint = 'INVITE_EXPIRED';
  end if;
  if v_invite.email <> v_email then
    raise exception 'This invite was made for a different email address' using errcode = 'P0001', hint = 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.school_staff (school_id, user_id, role)
  values (v_invite.school_id, auth.uid(), v_invite.role)
  on conflict (school_id, user_id) do update set role = excluded.role;

  update public.staff_invites set accepted_at = now(), accepted_by = auth.uid() where id = v_invite.id;

  if v_invite.staff_member_id is not null then
    update public.staff_members set user_id = auth.uid() where id = v_invite.staff_member_id;
  end if;

  select * into v_school from public.schools where id = v_invite.school_id;
  return v_school;
end $$;

-- ---------------------------------------------------------------------------
-- School onboarding: register a new school, or claim one already in the directory.
-- Either way the caller becomes its first admin and the school waits for verification.
-- ---------------------------------------------------------------------------
create or replace function public.create_school(
  p_name text, p_town text, p_province public.sa_province,
  p_phone text default null, p_email text default null,
  p_lowest_grade text default 'GR', p_highest_grade text default 'G7'
) returns public.schools language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_slug text;
  v_i int := 0;
  v_school public.schools;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = 'P0001', hint = 'NOT_SIGNED_IN';
  end if;
  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Please enter the school name' using errcode = 'P0001', hint = 'NAME_TOO_SHORT';
  end if;
  v_base := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := v_base;
  while exists (select 1 from public.schools where slug = v_slug) loop
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  end loop;

  insert into public.schools (slug, name, town, province, phone, email, lowest_grade, highest_grade, is_claimed, is_verified)
  values (v_slug, trim(p_name), trim(coalesce(p_town, '')), p_province, nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
          p_lowest_grade, p_highest_grade, true, false)
  returning * into v_school;

  insert into public.school_staff (school_id, user_id, role) values (v_school.id, auth.uid(), 'admin');
  return v_school;
end $$;

create or replace function public.claim_school(p_school_id uuid)
returns public.schools language plpgsql security definer set search_path = public as $$
declare
  v_school public.schools;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = 'P0001', hint = 'NOT_SIGNED_IN';
  end if;
  select * into v_school from public.schools where id = p_school_id for update;
  if not found then
    raise exception 'School not found' using errcode = 'P0002';
  end if;
  if v_school.is_claimed then
    raise exception 'This school has already been claimed. Ask your school to invite you, or contact Skoolo' using errcode = 'P0001', hint = 'SCHOOL_CLAIMED';
  end if;
  update public.schools set is_claimed = true, is_verified = false where id = p_school_id returning * into v_school;
  insert into public.school_staff (school_id, user_id, role) values (p_school_id, auth.uid(), 'admin');
  return v_school;
end $$;

-- Parents can only apply to schools Skoolo has verified.
create or replace view public.school_directory
with (security_invoker = true) as
select
  s.id, s.slug, s.name, s.badge_url, s.tagline, s.description, s.town, s.province,
  s.street_address, s.phone, s.email, s.website, s.lowest_grade, s.highest_grade,
  s.is_verified, s.is_claimed,
  ep.id as open_period_id, ep.academic_year as open_academic_year, ep.fee_amount, ep.currency,
  ep.opens_at, ep.closes_at,
  (s.is_claimed and s.is_verified and ep.id is not null) as is_open_for_registration,
  s.secondary_phone
from public.schools s
left join public.enrolment_periods ep on ep.school_id = s.id and ep.status = 'open';

-- ---------------------------------------------------------------------------
-- School badges: public bucket, admins upload under <school_id>/.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-badges', 'school-badges', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "badges are public" on storage.objects;
create policy "badges are public" on storage.objects for select
  using (bucket_id = 'school-badges');
drop policy if exists "admins upload badges" on storage.objects;
create policy "admins upload badges" on storage.objects for insert to authenticated
  with check (bucket_id = 'school-badges' and exists (
    select 1 from public.school_staff st where st.user_id = auth.uid() and st.role = 'admin'
      and st.school_id::text = (storage.foldername(name))[1]));
drop policy if exists "admins replace badges" on storage.objects;
create policy "admins replace badges" on storage.objects for update to authenticated
  using (bucket_id = 'school-badges' and exists (
    select 1 from public.school_staff st where st.user_id = auth.uid() and st.role = 'admin'
      and st.school_id::text = (storage.foldername(name))[1]));
drop policy if exists "admins delete badges" on storage.objects;
create policy "admins delete badges" on storage.objects for delete to authenticated
  using (bucket_id = 'school-badges' and exists (
    select 1 from public.school_staff st where st.user_id = auth.uid() and st.role = 'admin'
      and st.school_id::text = (storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- Staff documents: private bucket, admins only, under <school_id>/<staff_member_id>/.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  document_type text not null default 'other',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists staff_documents_member_idx on public.staff_documents (staff_member_id);
alter table public.staff_documents enable row level security;
drop policy if exists "admins manage staff documents" on public.staff_documents;
create policy "admins manage staff documents" on public.staff_documents for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-documents', 'staff-documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "admins read staff files" on storage.objects;
create policy "admins read staff files" on storage.objects for select to authenticated
  using (bucket_id = 'staff-documents' and exists (
    select 1 from public.school_staff st where st.user_id = auth.uid() and st.role = 'admin'
      and st.school_id::text = (storage.foldername(name))[1]));
drop policy if exists "admins upload staff files" on storage.objects;
create policy "admins upload staff files" on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-documents' and exists (
    select 1 from public.school_staff st where st.user_id = auth.uid() and st.role = 'admin'
      and st.school_id::text = (storage.foldername(name))[1]));
drop policy if exists "admins delete staff files" on storage.objects;
create policy "admins delete staff files" on storage.objects for delete to authenticated
  using (bucket_id = 'staff-documents' and exists (
    select 1 from public.school_staff st where st.user_id = auth.uid() and st.role = 'admin'
      and st.school_id::text = (storage.foldername(name))[1]));
