-- Stage 7: assessment detail. Teachers capture individual assessments per subject per term (tests,
-- assignments, projects, the end-of-year examination), each with a maximum score and a weight, and
-- a score per learner. Skoolo computes the term mark as the weighted average of the assessments the
-- learner sat and writes it into the Stage 3 report_marks, so approval and publishing are unchanged.
--
-- Policy (docs/report-card-spec.md, NPPPR 8(2)/15(2)): Grades R-3 are 100% school-based assessment;
-- Grades 4-6 are 75% school-based assessment and 25% end-of-year examination. Here that split is
-- expressed through the weights the teacher gives each assessment (an exam weighted at a quarter of
-- the total), which is how a teacher computes a term mark by hand; the policy is shown as guidance
-- in the screens. A structured per-phase weighting engine is a later refinement.

-- ---------------------------------------------------------------------------
-- An assessment: one piece of work for a class, subject and term.
-- ---------------------------------------------------------------------------
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  term_number int not null check (term_number between 1 and 4),
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'test' check (kind in ('test', 'assignment', 'project', 'exam', 'other')),
  max_score numeric(6, 2) not null default 100 check (max_score > 0),
  weight numeric(6, 2) not null default 1 check (weight > 0),
  assessed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_class_subject_term_idx on public.assessments (class_id, subject_id, term_number);
alter table public.assessments enable row level security;
create trigger assessments_set_updated_at before update on public.assessments
  for each row execute function public.set_updated_at();

-- A learner's score on one assessment. Absent means the learner did not sit it, so it is left out
-- of the weighted average rather than counted as zero.
create table public.assessment_scores (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  score numeric(6, 2) check (score is null or score >= 0),
  is_absent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, learner_id)
);
create index assessment_scores_assessment_idx on public.assessment_scores (assessment_id);
alter table public.assessment_scores enable row level security;
create trigger assessment_scores_set_updated_at before update on public.assessment_scores
  for each row execute function public.set_updated_at();

-- The class an assessment belongs to (for RLS and score checks), resolved past RLS.
create or replace function public.assessment_class_id(p_assessment_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.assessments where id = p_assessment_id;
$$;

-- Read access mirrors report marks: a teacher of the class or an admin of the school. Assessment
-- detail is staff-only; parents see the term mark through the published report, never the raw
-- scores. All writes go through the RPCs below.
create policy "read assessments you may edit" on public.assessments for select
  using (public.can_edit_class_reports(class_id));
create policy "read assessment scores you may edit" on public.assessment_scores for select
  using (public.can_edit_class_reports(public.assessment_class_id(assessment_id)));

-- ---------------------------------------------------------------------------
-- The weighted term mark for one learner and subject: the weighted average, as a percentage, of the
-- assessments in that term the learner actually sat (a non-null, non-absent score). Null when they
-- sat none.
-- ---------------------------------------------------------------------------
create or replace function public.computed_subject_term_mark(
  p_class_id uuid, p_subject_id uuid, p_learner_id uuid, p_term int
) returns numeric language sql stable security definer set search_path = public as $$
  select round(
    sum((sc.score / a.max_score * 100) * a.weight) / nullif(sum(a.weight), 0), 2
  )
  from public.assessments a
  join public.assessment_scores sc on sc.assessment_id = a.id and sc.learner_id = p_learner_id
  where a.class_id = p_class_id and a.subject_id = p_subject_id and a.term_number = p_term
    and sc.score is not null and not sc.is_absent;
$$;

-- Write the computed mark into the learner's draft report for this term (creating the report and
-- the mark row if needed). Approved and published reports are left untouched.
create or replace function public.recompute_report_mark(
  p_class_id uuid, p_subject_id uuid, p_learner_id uuid, p_term int
) returns void language plpgsql security definer set search_path = public as $$
declare v_class public.classes; v_report uuid; v_status public.report_status; v_mark numeric;
begin
  select * into v_class from public.classes where id = p_class_id;
  if not found then return; end if;

  insert into public.report_cards (school_id, class_id, learner_id, academic_year, term_number)
  values (v_class.school_id, p_class_id, p_learner_id, v_class.academic_year, p_term)
  on conflict (learner_id, academic_year, term_number) do nothing;

  select id, status into v_report, v_status from public.report_cards
    where learner_id = p_learner_id and academic_year = v_class.academic_year and term_number = p_term;
  if v_report is null or v_status <> 'draft' then return; end if;

  v_mark := public.computed_subject_term_mark(p_class_id, p_subject_id, p_learner_id, p_term);
  insert into public.report_marks (report_card_id, subject_id, mark)
  values (v_report, p_subject_id, v_mark)
  on conflict (report_card_id, subject_id) do update set mark = excluded.mark;
end $$;

-- ---------------------------------------------------------------------------
-- Write path: teachers of the class and the school's admins capture assessments and scores.
-- ---------------------------------------------------------------------------
create or replace function public.save_assessment(
  p_id uuid, p_class_id uuid, p_subject_id uuid, p_term int, p_title text,
  p_kind text, p_max_score numeric, p_weight numeric, p_assessed_on date
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_class public.classes; v_id uuid;
begin
  if not public.can_edit_class_reports(p_class_id) then
    raise exception 'You cannot capture assessments for this class' using errcode = 'P0001', hint = 'NOT_ALLOWED';
  end if;
  select * into v_class from public.classes where id = p_class_id;
  if not found then raise exception 'Class not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.subjects s
                 where s.id = p_subject_id and s.school_id = v_class.school_id and s.grade_code = v_class.grade_code) then
    raise exception 'That subject is not offered in this grade' using errcode = 'P0001', hint = 'BAD_SUBJECT';
  end if;

  if p_id is null then
    insert into public.assessments (school_id, class_id, subject_id, term_number, title, kind, max_score, weight, assessed_on)
    values (v_class.school_id, p_class_id, p_subject_id, p_term, p_title, coalesce(p_kind, 'test'),
            coalesce(p_max_score, 100), coalesce(p_weight, 1), p_assessed_on)
    returning id into v_id;
  else
    update public.assessments set title = p_title, kind = coalesce(p_kind, 'test'),
      max_score = coalesce(p_max_score, 100), weight = coalesce(p_weight, 1), assessed_on = p_assessed_on
    where id = p_id and class_id = p_class_id returning id into v_id;
    if v_id is null then raise exception 'Assessment not found' using errcode = 'P0002'; end if;
    -- a changed weight or max changes every learner's term mark
    perform public.recalculate_subject_term(p_class_id, p_subject_id, p_term);
  end if;
  return v_id;
end $$;

create or replace function public.delete_assessment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_a public.assessments;
begin
  select * into v_a from public.assessments where id = p_id;
  if not found then return; end if;
  if not public.can_edit_class_reports(v_a.class_id) then
    raise exception 'You cannot change assessments for this class' using errcode = 'P0001', hint = 'NOT_ALLOWED';
  end if;
  delete from public.assessments where id = p_id;
  perform public.recalculate_subject_term(v_a.class_id, v_a.subject_id, v_a.term_number);
end $$;

-- Capture or update one learner's score, then refresh that learner's term mark.
create or replace function public.save_assessment_score(
  p_assessment_id uuid, p_learner_id uuid, p_score numeric, p_is_absent boolean
) returns void language plpgsql security definer set search_path = public as $$
declare v_a public.assessments;
begin
  select * into v_a from public.assessments where id = p_assessment_id;
  if not found then raise exception 'Assessment not found' using errcode = 'P0002'; end if;
  if not public.can_edit_class_reports(v_a.class_id) then
    raise exception 'You cannot capture scores for this class' using errcode = 'P0001', hint = 'NOT_ALLOWED';
  end if;
  if p_score is not null and p_score > v_a.max_score then
    raise exception 'That score is more than the maximum' using errcode = 'P0001', hint = 'OVER_MAX';
  end if;

  insert into public.assessment_scores (assessment_id, learner_id, score, is_absent)
  values (p_assessment_id, p_learner_id, p_score, coalesce(p_is_absent, false))
  on conflict (assessment_id, learner_id) do update set score = excluded.score, is_absent = excluded.is_absent;

  perform public.recompute_report_mark(v_a.class_id, v_a.subject_id, p_learner_id, v_a.term_number);
end $$;

-- Recompute every learner's term mark for a subject (after an assessment is added, reweighted or
-- removed). Covers each learner who has a report for the term or a score in the subject.
create or replace function public.recalculate_subject_term(p_class_id uuid, p_subject_id uuid, p_term int)
returns void language plpgsql security definer set search_path = public as $$
declare v_learner uuid;
begin
  if not public.can_edit_class_reports(p_class_id) then
    raise exception 'Not allowed' using errcode = 'P0001', hint = 'NOT_ALLOWED';
  end if;
  for v_learner in
    select id from public.learners where current_class_id = p_class_id
  loop
    perform public.recompute_report_mark(p_class_id, p_subject_id, v_learner, p_term);
  end loop;
end $$;
