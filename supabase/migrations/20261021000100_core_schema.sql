-- Skoolo core schema: schools, enrolment periods, grade intake, learners, applications,
-- documents, messages. Every business rule that must hold lives here, not in the client.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.period_status as enum ('draft', 'open', 'closed');
create type public.application_status as enum (
  'submitted', 'under_review', 'more_info_needed', 'accepted', 'waitlisted', 'declined', 'withdrawn'
);
create type public.payment_status as enum ('unpaid', 'marked_paid', 'confirmed');
create type public.document_type as enum (
  'birth_certificate', 'parent_identity', 'proof_of_address', 'latest_report', 'immunisation_card', 'other'
);
create type public.gender as enum ('female', 'male', 'unspecified');
create type public.sa_province as enum (
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- South African ID: 13 digits, valid YYMMDD, Luhn checksum.
create or replace function public.is_valid_sa_identity_number(p_value text)
returns boolean language plpgsql immutable as $$
declare
  v_sum int := 0;
  v_digit int;
  v_index int;
begin
  if p_value is null or p_value !~ '^\d{13}$' then
    return false;
  end if;
  begin
    perform to_date(substr(p_value, 1, 6), 'YYMMDD');
  exception when others then
    return false;
  end;
  for v_index in 1..13 loop
    v_digit := substr(p_value, v_index, 1)::int;
    if v_index % 2 = 0 then
      v_digit := v_digit * 2;
      if v_digit > 9 then v_digit := v_digit - 9; end if;
    end if;
    v_sum := v_sum + v_digit;
  end loop;
  return v_sum % 10 = 0;
end $$;

-- ---------------------------------------------------------------------------
-- Grades (reference data, seeded in the next migration)
-- ---------------------------------------------------------------------------
create table public.grades (
  code text primary key,
  label text not null,
  sort_order int not null unique
);
alter table public.grades enable row level security;
create policy "grades are public" on public.grades for select using (true);

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, parent or staff
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Schools and staff
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  badge_url text,
  tagline text,
  description text,
  town text not null default '',
  province public.sa_province,
  street_address text,
  phone text,
  email text,
  website text,
  lowest_grade text references public.grades (code),
  highest_grade text references public.grades (code),
  is_verified boolean not null default false,
  is_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index schools_name_idx on public.schools (lower(name));
alter table public.schools enable row level security;
create trigger schools_set_updated_at before update on public.schools
  for each row execute function public.set_updated_at();

create table public.school_staff (
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (school_id, user_id)
);
alter table public.school_staff enable row level security;

create or replace function public.is_school_staff(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.school_staff s
    where s.school_id = p_school_id and s.user_id = auth.uid()
  );
$$;

create or replace function public.staff_school_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select s.school_id from public.school_staff s where s.user_id = auth.uid();
$$;

create policy "schools are public" on public.schools for select using (true);
create policy "staff update own school" on public.schools for update
  using (public.is_school_staff(id)) with check (public.is_school_staff(id));

create policy "staff see own school staff" on public.school_staff for select
  using (user_id = auth.uid() or public.is_school_staff(school_id));

-- Bank details are not public: staff manage them, parents receive them through a function.
create table public.school_bank_accounts (
  school_id uuid primary key references public.schools (id) on delete cascade,
  account_holder text not null,
  bank_name text not null,
  branch_code text not null,
  account_number text not null,
  account_type text not null default 'Cheque',
  updated_at timestamptz not null default now()
);
alter table public.school_bank_accounts enable row level security;
create trigger school_bank_accounts_set_updated_at before update on public.school_bank_accounts
  for each row execute function public.set_updated_at();
create policy "staff manage own bank account" on public.school_bank_accounts for all
  using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));

-- ---------------------------------------------------------------------------
-- Enrolment periods and grade intake
-- ---------------------------------------------------------------------------
create table public.enrolment_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year int not null check (academic_year between 2020 and 2100),
  name text not null,
  status public.period_status not null default 'draft',
  opens_at date,
  closes_at date,
  fee_amount numeric(12, 2) not null default 0 check (fee_amount >= 0),
  currency char(3) not null default 'ZAR',
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year)
);
create unique index enrolment_periods_one_open_per_school
  on public.enrolment_periods (school_id) where status = 'open';
alter table public.enrolment_periods enable row level security;
create trigger enrolment_periods_set_updated_at before update on public.enrolment_periods
  for each row execute function public.set_updated_at();

create policy "periods are public" on public.enrolment_periods for select using (true);
create policy "staff manage own periods" on public.enrolment_periods for all
  using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));

create table public.period_grades (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.enrolment_periods (id) on delete cascade,
  grade_code text not null references public.grades (code),
  is_open boolean not null default true,
  capacity int check (capacity is null or capacity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, grade_code)
);
alter table public.period_grades enable row level security;
create trigger period_grades_set_updated_at before update on public.period_grades
  for each row execute function public.set_updated_at();

create or replace function public.period_school_id(p_period_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.enrolment_periods where id = p_period_id;
$$;

create policy "period grades are public" on public.period_grades for select using (true);
create policy "staff manage own period grades" on public.period_grades for all
  using (public.is_school_staff(public.period_school_id(period_id)))
  with check (public.is_school_staff(public.period_school_id(period_id)));

-- ---------------------------------------------------------------------------
-- Learners (children), owned by the parent who created them
-- ---------------------------------------------------------------------------
create table public.learners (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  date_of_birth date not null,
  gender public.gender not null default 'unspecified',
  identity_number text,
  passport_number text,
  nationality text not null default 'South African',
  home_language text,
  previous_school text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learners_one_identity check (
    (identity_number is not null and passport_number is null)
    or (identity_number is null and passport_number is not null)
  ),
  constraint learners_valid_sa_identity check (
    identity_number is null or public.is_valid_sa_identity_number(identity_number)
  )
);
create index learners_parent_idx on public.learners (parent_id);
alter table public.learners enable row level security;
create trigger learners_set_updated_at before update on public.learners
  for each row execute function public.set_updated_at();

create policy "parents manage own learners" on public.learners for all
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  period_id uuid not null references public.enrolment_periods (id),
  period_grade_id uuid not null references public.period_grades (id),
  learner_id uuid not null references public.learners (id),
  parent_id uuid not null references public.profiles (id),
  status public.application_status not null default 'submitted',
  payment_status public.payment_status not null default 'unpaid',
  payment_reference text not null unique,
  marked_paid_at timestamptz,
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid references public.profiles (id),
  -- residential address, captured per application so a move does not rewrite history
  address_line text not null,
  suburb text not null default '',
  town text not null,
  province public.sa_province not null,
  postal_code text not null default '',
  -- transport: optional, purpose stated on the form (future transport feature)
  uses_school_transport boolean,
  transport_provider_name text,
  parent_note text,
  staff_note text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, period_id)
);
create index applications_school_status_idx on public.applications (school_id, status);
create index applications_parent_idx on public.applications (parent_id);
create index applications_period_grade_idx on public.applications (period_grade_id);
alter table public.applications enable row level security;
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- Reference: ENR- plus six characters from an alphabet without 0/O/1/I.
create or replace function public.generate_payment_reference()
returns text language plpgsql as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
begin
  loop
    v_code := 'ENR-';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.applications where payment_reference = v_code);
  end loop;
  return v_code;
end $$;

-- Before insert: derive school/period from the chosen grade intake, check the period is open,
-- the grade is open, the grade has space, and the learner belongs to the applicant.
create or replace function public.applications_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_intake record;
  v_taken int;
begin
  select pg.id, pg.period_id, pg.is_open, pg.capacity, ep.status as period_status, ep.school_id
    into v_intake
  from public.period_grades pg
  join public.enrolment_periods ep on ep.id = pg.period_id
  where pg.id = new.period_grade_id
  for update of pg;

  if not found then
    raise exception 'Grade intake not found' using errcode = 'P0002';
  end if;
  if v_intake.period_status <> 'open' then
    raise exception 'Enrolment at this school is closed' using errcode = 'P0001', hint = 'PERIOD_CLOSED';
  end if;
  if not v_intake.is_open then
    raise exception 'This grade is not accepting applications' using errcode = 'P0001', hint = 'GRADE_CLOSED';
  end if;

  new.school_id := v_intake.school_id;
  new.period_id := v_intake.period_id;
  new.parent_id := auth.uid();
  new.status := 'submitted';
  new.payment_status := 'unpaid';
  new.payment_reference := public.generate_payment_reference();
  new.submitted_at := now();

  if not exists (select 1 from public.learners l where l.id = new.learner_id and l.parent_id = new.parent_id) then
    raise exception 'Learner does not belong to the applicant' using errcode = 'P0001', hint = 'LEARNER_NOT_OWNED';
  end if;

  if v_intake.capacity is not null then
    select count(*) into v_taken
    from public.applications a
    where a.period_grade_id = new.period_grade_id
      and a.status not in ('declined', 'withdrawn');
    if v_taken >= v_intake.capacity then
      raise exception 'This grade is full' using errcode = 'P0001', hint = 'GRADE_FULL';
    end if;
  end if;

  return new;
end $$;
create trigger applications_before_insert before insert on public.applications
  for each row execute function public.applications_before_insert();

-- Allowed status transitions.
create or replace function public.is_allowed_status_transition(
  p_from public.application_status, p_to public.application_status
) returns boolean language sql immutable as $$
  select case p_from
    when 'submitted'        then p_to in ('under_review', 'more_info_needed', 'accepted', 'waitlisted', 'declined', 'withdrawn')
    when 'under_review'     then p_to in ('more_info_needed', 'accepted', 'waitlisted', 'declined', 'withdrawn')
    when 'more_info_needed' then p_to in ('under_review', 'accepted', 'waitlisted', 'declined', 'withdrawn')
    when 'waitlisted'       then p_to in ('under_review', 'accepted', 'declined', 'withdrawn')
    when 'accepted'         then p_to in ('declined', 'withdrawn')
    else false
  end;
$$;

create or replace function public.applications_before_update()
returns trigger language plpgsql as $$
begin
  if new.status <> old.status and not public.is_allowed_status_transition(old.status, new.status) then
    raise exception 'Cannot move an application from % to %', old.status, new.status
      using errcode = 'P0001', hint = 'INVALID_TRANSITION';
  end if;
  -- Immutable columns
  new.school_id := old.school_id;
  new.period_id := old.period_id;
  new.period_grade_id := old.period_grade_id;
  new.learner_id := old.learner_id;
  new.parent_id := old.parent_id;
  new.payment_reference := old.payment_reference;
  new.submitted_at := old.submitted_at;
  return new;
end $$;
create trigger applications_before_update before update on public.applications
  for each row execute function public.applications_before_update();

-- ---------------------------------------------------------------------------
-- Status history and messages
-- ---------------------------------------------------------------------------
create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history (application_id);
alter table public.application_status_history enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  application_id uuid references public.applications (id) on delete cascade,
  subject text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_recipient_idx on public.messages (recipient_id, created_at desc);
alter table public.messages enable row level security;

create or replace function public.application_message(
  p_application public.applications, p_subject text, p_body text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.messages (recipient_id, school_id, application_id, subject, body)
  values (p_application.parent_id, p_application.school_id, p_application.id, p_subject, p_body);
end $$;

create or replace function public.applications_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_school text;
  v_learner text;
  v_grade text;
begin
  select s.name into v_school from public.schools s where s.id = new.school_id;
  select l.first_name || ' ' || l.last_name into v_learner from public.learners l where l.id = new.learner_id;
  select g.label into v_grade
    from public.period_grades pg join public.grades g on g.code = pg.grade_code
    where pg.id = new.period_grade_id;

  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
    perform public.application_message(new,
      'Application received',
      format('We have received %s''s application to %s for %s. Your payment reference is %s. We will let you know as soon as the school has reviewed it.',
        v_learner, v_school, v_grade, new.payment_reference));
    return new;
  end if;

  if new.status <> old.status then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(), new.staff_note);
    perform public.application_message(new,
      case new.status
        when 'under_review'     then 'Your application is being reviewed'
        when 'more_info_needed' then 'The school needs more information'
        when 'accepted'         then 'Application accepted'
        when 'waitlisted'       then 'Application placed on the waiting list'
        when 'declined'         then 'Application outcome'
        when 'withdrawn'        then 'Application withdrawn'
        else 'Application update'
      end,
      case new.status
        when 'under_review'     then format('%s is reviewing %s''s application for %s.', v_school, v_learner, v_grade)
        when 'more_info_needed' then format('%s needs more information before they can continue with %s''s application. %s', v_school, v_learner, coalesce(new.staff_note, 'Please open the application for details.'))
        when 'accepted'         then format('%s has accepted %s''s application for %s.', v_school, v_learner, v_grade)
        when 'waitlisted'       then format('%s has placed %s''s application for %s on the waiting list. We will tell you if a place opens up.', v_school, v_learner, v_grade)
        when 'declined'         then format('%s was unable to offer %s a place in %s. %s', v_school, v_learner, v_grade, coalesce(new.staff_note, ''))
        when 'withdrawn'        then format('%s''s application to %s has been withdrawn.', v_learner, v_school)
        else ''
      end);
  end if;

  if new.payment_status = 'confirmed' and old.payment_status <> 'confirmed' then
    perform public.application_message(new,
      format('Welcome to %s', v_school),
      format('Thank you. %s has confirmed your enrolment payment for %s. Welcome to the %s family! The school will be in touch with the next steps.',
        v_school, v_learner, v_school));
  end if;

  return new;
end $$;
create trigger applications_after_change after insert or update on public.applications
  for each row execute function public.applications_after_change();

-- ---------------------------------------------------------------------------
-- Application policies
-- ---------------------------------------------------------------------------
create policy "parents see own applications" on public.applications for select
  using (parent_id = auth.uid());
create policy "parents create own applications" on public.applications for insert
  with check (auth.uid() is not null);
create policy "staff see school applications" on public.applications for select
  using (public.is_school_staff(school_id));
create policy "staff update school applications" on public.applications for update
  using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));

create policy "parents see own history" on public.application_status_history for select
  using (exists (select 1 from public.applications a where a.id = application_id and a.parent_id = auth.uid()));
create policy "staff see school history" on public.application_status_history for select
  using (exists (select 1 from public.applications a where a.id = application_id and public.is_school_staff(a.school_id)));

create policy "recipients read own messages" on public.messages for select
  using (recipient_id = auth.uid());
create policy "recipients mark own messages read" on public.messages for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "staff message school applicants" on public.messages for insert
  with check (
    school_id is not null and public.is_school_staff(school_id)
    and (application_id is null or exists (
      select 1 from public.applications a where a.id = application_id and a.school_id = messages.school_id and a.parent_id = recipient_id))
  );
create policy "staff see messages they sent to applicants" on public.messages for select
  using (school_id is not null and public.is_school_staff(school_id));

-- Profiles: own row, plus staff may see the parents who applied to their school.
create policy "users see own profile" on public.profiles for select using (id = auth.uid());
create policy "users update own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "staff see applicant profiles" on public.profiles for select
  using (exists (select 1 from public.applications a where a.parent_id = profiles.id and public.is_school_staff(a.school_id)));
create policy "staff see school learners" on public.learners for select
  using (exists (select 1 from public.applications a where a.learner_id = learners.id and public.is_school_staff(a.school_id)));

-- ---------------------------------------------------------------------------
-- Documents (metadata; files live in the private storage bucket)
-- ---------------------------------------------------------------------------
create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  document_type public.document_type not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  uploaded_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index application_documents_app_idx on public.application_documents (application_id);
alter table public.application_documents enable row level security;

create policy "parents manage own documents" on public.application_documents for all
  using (exists (select 1 from public.applications a where a.id = application_id and a.parent_id = auth.uid()))
  with check (exists (select 1 from public.applications a where a.id = application_id and a.parent_id = auth.uid()));
create policy "staff see school documents" on public.application_documents for select
  using (exists (select 1 from public.applications a where a.id = application_id and public.is_school_staff(a.school_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-documents', 'application-documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Object path convention: <application_id>/<document_type>/<file_name>
create policy "parents upload own application files" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and exists (select 1 from public.applications a
                where a.id::text = (storage.foldername(name))[1] and a.parent_id = auth.uid())
  );
create policy "parents read own application files" on storage.objects for select to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (select 1 from public.applications a
                where a.id::text = (storage.foldername(name))[1] and a.parent_id = auth.uid())
  );
create policy "parents delete own application files" on storage.objects for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (select 1 from public.applications a
                where a.id::text = (storage.foldername(name))[1] and a.parent_id = auth.uid())
  );
create policy "staff read school application files" on storage.objects for select to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (select 1 from public.applications a
                where a.id::text = (storage.foldername(name))[1] and public.is_school_staff(a.school_id))
  );

-- ---------------------------------------------------------------------------
-- RPC functions used by the apps
-- ---------------------------------------------------------------------------

-- Parent: payment screen. Bank details, fee and reference for an application they own.
create or replace function public.get_payment_instructions(p_application_id uuid)
returns table (
  payment_reference text, fee_amount numeric, currency char(3), payment_status public.payment_status,
  school_name text, account_holder text, bank_name text, branch_code text, account_number text,
  account_type text, instructions text
) language sql stable security definer set search_path = public as $$
  select a.payment_reference, ep.fee_amount, ep.currency, a.payment_status,
         s.name, b.account_holder, b.bank_name, b.branch_code, b.account_number, b.account_type,
         ep.instructions
  from public.applications a
  join public.enrolment_periods ep on ep.id = a.period_id
  join public.schools s on s.id = a.school_id
  left join public.school_bank_accounts b on b.school_id = a.school_id
  where a.id = p_application_id and a.parent_id = auth.uid();
$$;

-- Parent: "I have paid".
create or replace function public.mark_application_paid(p_application_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.applications
  set payment_status = 'marked_paid', marked_paid_at = now()
  where id = p_application_id and parent_id = auth.uid() and payment_status = 'unpaid';
  if not found then
    raise exception 'Application not found or already marked as paid' using errcode = 'P0001', hint = 'CANNOT_MARK_PAID';
  end if;
end $$;

-- Parent: withdraw.
create or replace function public.withdraw_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.applications set status = 'withdrawn'
  where id = p_application_id and parent_id = auth.uid()
    and status not in ('declined', 'withdrawn');
  if not found then
    raise exception 'Application cannot be withdrawn' using errcode = 'P0001', hint = 'CANNOT_WITHDRAW';
  end if;
end $$;

-- Staff: confirm the payment arrived. Also accepts the application unless it was declined.
create or replace function public.confirm_application_payment(p_application_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found or not public.is_school_staff(v_app.school_id) then
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

-- Staff: change status with an optional note (the note is what the parent sees for more_info_needed / declined).
create or replace function public.set_application_status(
  p_application_id uuid, p_status public.application_status, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found or not public.is_school_staff(v_app.school_id) then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  update public.applications
  set status = p_status, staff_note = p_note
  where id = p_application_id;
end $$;

-- Directory: schools with their open period, if any, and whether registration is possible.
create or replace view public.school_directory
with (security_invoker = true) as
select
  s.id, s.slug, s.name, s.badge_url, s.tagline, s.description, s.town, s.province,
  s.street_address, s.phone, s.email, s.website, s.lowest_grade, s.highest_grade,
  s.is_verified, s.is_claimed,
  ep.id as open_period_id, ep.academic_year as open_academic_year, ep.fee_amount, ep.currency,
  ep.opens_at, ep.closes_at,
  (s.is_claimed and ep.id is not null) as is_open_for_registration
from public.schools s
left join public.enrolment_periods ep on ep.school_id = s.id and ep.status = 'open';

-- Grade intake with live availability, for the parent's grade dropdown and the staff dashboard.
create or replace view public.period_grade_availability
with (security_invoker = true) as
select
  pg.id, pg.period_id, pg.grade_code, g.label as grade_label, g.sort_order, pg.is_open, pg.capacity,
  (select count(*) from public.applications a
     where a.period_grade_id = pg.id and a.status not in ('declined', 'withdrawn'))::int as places_taken,
  case when pg.capacity is null then null
       else greatest(pg.capacity - (select count(*) from public.applications a
             where a.period_grade_id = pg.id and a.status not in ('declined', 'withdrawn')), 0)::int
  end as places_left,
  (pg.is_open and (pg.capacity is null or pg.capacity > (select count(*) from public.applications a
             where a.period_grade_id = pg.id and a.status not in ('declined', 'withdrawn')))) as is_available
from public.period_grades pg
join public.grades g on g.code = pg.grade_code;
