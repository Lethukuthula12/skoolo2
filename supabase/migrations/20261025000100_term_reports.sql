-- Stage 3: term reports generated from marks. The school captures a mark per subject per learner
-- per term; Skoolo applies the national 7-point scale; the principal approves; publishing sends
-- the report to connected parents. Report format and rules: docs/report-card-spec.md.

-- ---------------------------------------------------------------------------
-- The national scale of achievement (Grades R-9), same bands across the phases.
-- ---------------------------------------------------------------------------
create or replace function public.achievement_level(p_mark numeric)
returns int language sql immutable as $$
  select case
    when p_mark is null then null
    when p_mark >= 80 then 7
    when p_mark >= 70 then 6
    when p_mark >= 60 then 5
    when p_mark >= 50 then 4
    when p_mark >= 40 then 3
    when p_mark >= 30 then 2
    else 1
  end;
$$;

create or replace function public.achievement_description(p_level int)
returns text language sql immutable as $$
  select case p_level
    when 7 then 'Outstanding achievement'
    when 6 then 'Meritorious achievement'
    when 5 then 'Substantial achievement'
    when 4 then 'Adequate achievement'
    when 3 then 'Moderate achievement'
    when 2 then 'Elementary achievement'
    when 1 then 'Not achieved'
    else null
  end;
$$;

-- School stamp for the report (public, like the badge).
alter table public.schools add column if not exists stamp_url text;

-- ---------------------------------------------------------------------------
-- Term dates (for the report's opening and closing dates).
-- ---------------------------------------------------------------------------
create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year int not null check (academic_year between 2020 and 2100),
  term_number int not null check (term_number between 1 and 4),
  opens_at date,
  closes_at date,
  next_term_opens_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year, term_number)
);
alter table public.academic_terms enable row level security;
create trigger academic_terms_set_updated_at before update on public.academic_terms
  for each row execute function public.set_updated_at();
create policy "terms are readable by school staff" on public.academic_terms for select
  using (public.is_school_staff(school_id));
create policy "admins manage terms" on public.academic_terms for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- ---------------------------------------------------------------------------
-- One report card per learner per term; a mark per subject under it.
-- ---------------------------------------------------------------------------
create type public.report_status as enum ('draft', 'approved', 'published');

create table public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  academic_year int not null,
  term_number int not null check (term_number between 1 and 4),
  status public.report_status not null default 'draft',
  days_absent int check (days_absent is null or days_absent >= 0),
  teacher_comment text,
  principal_comment text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, academic_year, term_number)
);
create index report_cards_class_term_idx on public.report_cards (class_id, academic_year, term_number);
alter table public.report_cards enable row level security;
create trigger report_cards_set_updated_at before update on public.report_cards
  for each row execute function public.set_updated_at();

create table public.report_marks (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  mark numeric(5, 2) check (mark is null or (mark >= 0 and mark <= 100)),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_card_id, subject_id)
);
create index report_marks_card_idx on public.report_marks (report_card_id);
alter table public.report_marks enable row level security;
create trigger report_marks_set_updated_at before update on public.report_marks
  for each row execute function public.set_updated_at();

-- Who may read a report card: the school's admins, a teacher of its class, or a connected parent
-- once it is published. All writes go through the RPCs in the next migration, so there are no
-- write policies here.
create or replace function public.can_read_report(p_report_card_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.report_cards rc
    where rc.id = p_report_card_id and (
      public.is_school_admin(rc.school_id)
      or public.teaches_class(rc.class_id)
      or (rc.status = 'published' and exists (
        select 1 from public.learners l
        where l.id = rc.learner_id and (
          l.parent_id = auth.uid()
          or exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.user_id = auth.uid())
        )
      ))
    )
  );
$$;

create policy "read report cards you are entitled to" on public.report_cards for select
  using (public.can_read_report(id));
create policy "read report marks you are entitled to" on public.report_marks for select
  using (public.can_read_report(report_card_id));
