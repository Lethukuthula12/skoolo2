-- Stage 1 data model: the school's own register of learners in classes, the subjects each grade
-- offers, and which teacher teaches what. Set up entirely by the school's admin.
--
-- Teaching model: below a per-school grade threshold one class teacher teaches the whole class;
-- at and above it, each subject in a class has its own teacher. The threshold is a school setting,
-- never a constant.

-- ---------------------------------------------------------------------------
-- School setting: where subject teaching begins.
-- ---------------------------------------------------------------------------
alter table public.schools
  add column if not exists subject_teaching_from_grade text references public.grades (code) default 'G4';

-- ---------------------------------------------------------------------------
-- Subjects a grade offers (CAPS defaults are seeded by a function the admin runs; editable after).
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  grade_code text not null references public.grades (code),
  name text not null check (length(trim(name)) > 0),
  -- language subjects are reported at a level; others leave this null
  language_level text check (language_level in ('home', 'first_additional', 'second_additional')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, grade_code, name)
);
create index subjects_school_grade_idx on public.subjects (school_id, grade_code);
alter table public.subjects enable row level security;
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();
create policy "admins manage subjects" on public.subjects for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "staff see school subjects" on public.subjects for select
  using (public.is_school_staff(school_id));

-- ---------------------------------------------------------------------------
-- Classes, each with a class teacher from the staff register.
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year int not null check (academic_year between 2020 and 2100),
  grade_code text not null references public.grades (code),
  name text not null check (length(trim(name)) > 0),
  class_teacher_id uuid references public.staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year, grade_code, name)
);
create index classes_school_year_idx on public.classes (school_id, academic_year);
alter table public.classes enable row level security;
create trigger classes_set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create policy "admins manage classes" on public.classes for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "staff see school classes" on public.classes for select
  using (public.is_school_staff(school_id));

create or replace function public.class_school_id(p_class_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.classes where id = p_class_id;
$$;

-- ---------------------------------------------------------------------------
-- Subject teachers for a class (used by the subject-teaching grades).
-- ---------------------------------------------------------------------------
create table public.class_subject_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  teacher_id uuid references public.staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, subject_id)
);
create index class_subject_teachers_class_idx on public.class_subject_teachers (class_id);
alter table public.class_subject_teachers enable row level security;
create trigger class_subject_teachers_set_updated_at before update on public.class_subject_teachers
  for each row execute function public.set_updated_at();
create policy "admins manage class subject teachers" on public.class_subject_teachers for all
  using (public.is_school_admin(public.class_school_id(class_id)))
  with check (public.is_school_admin(public.class_school_id(class_id)));
create policy "staff see school class subject teachers" on public.class_subject_teachers for select
  using (public.is_school_staff(public.class_school_id(class_id)));

-- Does the signed-in user teach this class (as class teacher or a subject teacher)?
create or replace function public.teaches_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classes c
    join public.staff_members sm on sm.id = c.class_teacher_id
    where c.id = p_class_id and sm.user_id = auth.uid()
  ) or exists (
    select 1 from public.class_subject_teachers cst
    join public.staff_members sm on sm.id = cst.teacher_id
    where cst.class_id = p_class_id and sm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Learners: unify the enrolment applicant and the school's register. A learner may be
-- parent-created (during an application, school_id null) or school-created (imported,
-- parent_id null) and later linked to both.
-- ---------------------------------------------------------------------------
alter table public.learners
  add column if not exists school_id uuid references public.schools (id) on delete set null,
  add column if not exists current_class_id uuid references public.classes (id) on delete set null,
  add column if not exists admission_number text,
  add column if not exists years_in_phase int check (years_in_phase is null or years_in_phase >= 0);

alter table public.learners alter column parent_id drop not null;
alter table public.learners add constraint learners_has_owner
  check (parent_id is not null or school_id is not null);

-- Young learners may have no ID yet: require not BOTH, instead of exactly one.
alter table public.learners drop constraint if exists learners_one_identity;
alter table public.learners add constraint learners_not_both_identity
  check (not (identity_number is not null and passport_number is not null));

create index if not exists learners_school_class_idx on public.learners (school_id, current_class_id);
alter table public.learners add constraint learners_school_admission_unique unique (school_id, admission_number);

-- Admins manage their school's learners (import, edit, move between classes).
create policy "admins manage school learners" on public.learners for all
  using (school_id is not null and public.is_school_admin(school_id))
  with check (school_id is not null and public.is_school_admin(school_id));

-- Teachers see only the learners in the classes they teach.
create policy "teachers see their class learners" on public.learners for select
  using (current_class_id is not null and public.teaches_class(current_class_id));

-- ---------------------------------------------------------------------------
-- Guardians (contact people) for a learner.
-- ---------------------------------------------------------------------------
create table public.learner_guardians (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  relationship text not null default '',
  phone text not null default '',
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index learner_guardians_learner_idx on public.learner_guardians (learner_id);
alter table public.learner_guardians enable row level security;
create trigger learner_guardians_set_updated_at before update on public.learner_guardians
  for each row execute function public.set_updated_at();

create or replace function public.learner_school_id(p_learner_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.learners where id = p_learner_id;
$$;
create or replace function public.learner_parent_id(p_learner_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select parent_id from public.learners where id = p_learner_id;
$$;

create policy "admins manage school learner guardians" on public.learner_guardians for all
  using (public.is_school_admin(public.learner_school_id(learner_id)))
  with check (public.is_school_admin(public.learner_school_id(learner_id)));
create policy "parents manage own learner guardians" on public.learner_guardians for all
  using (public.learner_parent_id(learner_id) = auth.uid())
  with check (public.learner_parent_id(learner_id) = auth.uid());
