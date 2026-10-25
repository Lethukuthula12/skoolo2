-- Assessment paper authoring. Every write is an authorised, version-checked RPC.
create table public.paper_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  instructions text not null default '' check (length(instructions) <= 5000),
  duration_minutes int not null default 60 check (duration_minutes between 1 and 600),
  footer text not null default '' check (length(footer) <= 500),
  updated_at timestamptz not null default now(),
  unique(school_id, name)
);
alter table public.paper_templates enable row level security;
create policy "staff read school paper templates" on public.paper_templates for select
  using (public.is_school_staff(school_id));
create policy "admins manage school paper templates" on public.paper_templates for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create trigger paper_templates_updated before update on public.paper_templates
  for each row execute function public.set_updated_at();

create table public.assessment_papers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  reviewer_id uuid not null references public.profiles(id),
  class_id uuid not null references public.classes(id),
  subject_id uuid not null references public.subjects(id),
  term_number int not null check (term_number between 1 and 4),
  title text not null check (length(trim(title)) between 1 and 200),
  kind text not null default 'test' check (kind in ('test','assignment','project','exam','other')),
  assessed_on date,
  duration_minutes int not null check (duration_minutes between 1 and 600),
  instructions text not null default '' check (length(instructions) <= 5000),
  footer text not null default '' check (length(footer) <= 500),
  questions jsonb not null default '[]',
  total_marks numeric(6,2) not null default 0 check (total_marks >= 0),
  status text not null default 'draft' check (status in ('draft','in_review','approved')),
  revision int not null default 1,
  revises_id uuid references public.assessment_papers(id),
  assessment_id uuid references public.assessments(id) on delete restrict,
  display_context jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);
create index assessment_papers_school_updated on public.assessment_papers(school_id, updated_at desc);
alter table public.assessment_papers enable row level security;
create policy "authors and admins read papers" on public.assessment_papers for select using (
  public.is_school_admin(school_id) or (public.is_school_staff(school_id) and author_id = auth.uid())
);

create table public.paper_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  paper_id uuid not null references public.assessment_papers(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index paper_events_paper on public.paper_events(paper_id, created_at);
alter table public.paper_events enable row level security;
create policy "read accessible paper history" on public.paper_events for select using (
  exists (select 1 from public.assessment_papers p where p.id = paper_id and p.school_id = paper_events.school_id)
);
-- No direct INSERT/UPDATE/DELETE policies for papers or events.

-- Narrow subject-level authoring access, with current school membership required.
create function public.can_author_paper(p_class_id uuid, p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classes c join public.subjects s on s.id = p_subject_id
      and s.school_id = c.school_id and s.grade_code = c.grade_code
    where c.id = p_class_id and public.is_school_staff(c.school_id) and (
      public.is_school_admin(c.school_id)
      or exists (select 1 from public.staff_members sm where sm.id = c.class_teacher_id and sm.user_id = auth.uid())
      or exists (select 1 from public.class_subject_teachers ct join public.staff_members sm on sm.id = ct.teacher_id
        where ct.class_id = c.id and ct.subject_id = s.id and sm.user_id = auth.uid())
    )
  );
$$;

create function public.paper_authoring_options(p_school_id uuid)
returns table(class_id uuid, class_name text, grade_code text, academic_year int, subject_id uuid, subject_name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.grade_code, c.academic_year, s.id, s.name
  from public.classes c join public.subjects s on s.school_id = c.school_id and s.grade_code = c.grade_code
  where c.school_id = p_school_id and public.can_author_paper(c.id, s.id)
  order by c.academic_year desc, c.grade_code, c.name, s.sort_order;
$$;

create function public.paper_reviewers(p_school_id uuid)
returns table(user_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select ss.user_id, p.full_name from public.school_staff ss join public.profiles p on p.id = ss.user_id
  where ss.school_id = p_school_id and ss.role = 'admin' and public.is_school_staff(p_school_id)
  order by p.full_name;
$$;

-- Validate bounded, plain-text structured content. Raster images are embedded in the private
-- paper, so neither public storage URLs nor expiring download URLs can expose/break a test.
create function public.paper_question_total(p_questions jsonb, p_complete boolean)
returns numeric language plpgsql immutable set search_path = public as $$
declare q jsonb; v_total numeric := 0; v_count int := 0; v_marks numeric;
begin
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or octet_length(p_questions::text) > 8000000 then
    raise exception 'Paper content must be an array under 8 MB';
  end if;
  if jsonb_array_length(p_questions) > 100 then raise exception 'Use at most 100 blocks'; end if;
  for q in select value from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q) <> 'object' or coalesce(q->>'type','') not in ('section','short','long','choice','image','table','page_break')
      or coalesce(jsonb_typeof(q->'text'),'') <> 'string' or length(q->>'text') > 10000
      or coalesce(jsonb_typeof(q->'answer'),'') <> 'string' or length(q->>'answer') > 10000
      or coalesce(jsonb_typeof(q->'marks'),'') <> 'number'
      or coalesce(jsonb_typeof(q->'lines'),'') <> 'number'
      or coalesce(jsonb_typeof(q->'options'),'') <> 'string' or length(q->>'options') > 5000
      or coalesce(jsonb_typeof(q->'cells'),'') <> 'string' or length(q->>'cells') > 10000
      or coalesce(jsonb_typeof(q->'image'),'') <> 'string'
    then raise exception 'Invalid question block'; end if;
    v_marks := (q->>'marks')::numeric;
    if v_marks < 0 or v_marks > 999 or v_marks <> round(v_marks, 2)
      or (q->>'lines')::numeric not between 0 and 30 or (q->>'lines')::numeric <> trunc((q->>'lines')::numeric)
    then raise exception 'Invalid marks or answer space'; end if;
    if q->>'type' in ('section','page_break') and v_marks <> 0 then raise exception 'Sections cannot carry marks'; end if;
    if length(q->>'image') > 1400000 or ((q->>'image') <> '' and
      (q->>'image') !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$')
    then raise exception 'Use a PNG, JPEG or WebP image under 1 MB'; end if;
    if p_complete then
      if q->>'type' <> 'page_break' and length(trim(q->>'text')) = 0 then raise exception 'Give every block a heading or question'; end if;
      if q->>'type' = 'image' and q->>'image' = '' then raise exception 'Add the missing image'; end if;
      if q->>'type' = 'table' and length(trim(q->>'cells')) = 0 then raise exception 'Add the table rows'; end if;
      if q->>'type' = 'choice' and array_length(regexp_split_to_array(trim(q->>'options'), E'\n'), 1) < 2
        then raise exception 'Multiple choice needs at least two options'; end if;
    end if;
    if q->>'type' not in ('section','page_break') then v_count := v_count + 1; end if;
    v_total := v_total + v_marks;
  end loop;
  if v_total > 9999 then raise exception 'Total marks cannot exceed 9999'; end if;
  if p_complete and (v_count = 0 or v_total <= 0) then raise exception 'Add questions and marks before submitting'; end if;
  return v_total;
end $$;

create function public.save_assessment_paper(p_id uuid, p_revision int, p_school_id uuid, p_content jsonb)
returns public.assessment_papers language plpgsql security definer set search_path = public as $$
declare v_p public.assessment_papers; v_class public.classes; v_subject public.subjects;
  v_reviewer uuid := (p_content->>'reviewer_id')::uuid; v_total numeric; v_context jsonb;
begin
  if not public.is_school_staff(p_school_id) then raise exception 'Not allowed'; end if;
  if p_id is not null then
    select * into v_p from public.assessment_papers where id = p_id and school_id = p_school_id for update;
    if not found or v_p.author_id <> auth.uid() then raise exception 'Only the author can edit this paper'; end if;
    if v_p.status <> 'draft' then raise exception 'Only drafts can be edited'; end if;
    if p_revision is distinct from v_p.revision then raise exception 'This paper changed in another window. Reload before editing.'; end if;
  end if;
  if not public.can_author_paper((p_content->>'class_id')::uuid, (p_content->>'subject_id')::uuid) then
    raise exception 'Choose a class and subject you teach';
  end if;
  select * into v_class from public.classes where id = (p_content->>'class_id')::uuid and school_id = p_school_id;
  if not found then raise exception 'Class not found'; end if;
  select * into v_subject from public.subjects where id = (p_content->>'subject_id')::uuid and school_id = p_school_id;
  if not exists (select 1 from public.school_staff where school_id = p_school_id and user_id = v_reviewer and role = 'admin') then
    raise exception 'Choose a current school administrator as reviewer'; end if;
  v_total := public.paper_question_total(p_content->'questions', false);
  select jsonb_build_object('school_name', s.name, 'badge_url', s.badge_url,
    'class_name', v_class.grade_code || ' ' || v_class.name, 'academic_year', v_class.academic_year,
    'subject_name', v_subject.name, 'author_name', p.full_name)
    into v_context from public.schools s join public.profiles p on p.id = auth.uid() where s.id = p_school_id;
  if p_id is null then
    insert into public.assessment_papers(school_id, author_id, reviewer_id, class_id, subject_id, term_number,
      title, kind, assessed_on, duration_minutes, instructions, footer, questions, total_marks, display_context)
    values(p_school_id, auth.uid(), v_reviewer, v_class.id, v_subject.id, (p_content->>'term_number')::int,
      trim(p_content->>'title'), p_content->>'kind', nullif(p_content->>'assessed_on','')::date,
      (p_content->>'duration_minutes')::int, p_content->>'instructions', p_content->>'footer', p_content->'questions', v_total, v_context)
    returning * into v_p;
    insert into public.paper_events(school_id, paper_id, actor_id, action) values(p_school_id, v_p.id, auth.uid(), 'created');
  else
    update public.assessment_papers set reviewer_id = v_reviewer, class_id = v_class.id, subject_id = v_subject.id,
      term_number = (p_content->>'term_number')::int, title = trim(p_content->>'title'), kind = p_content->>'kind',
      assessed_on = nullif(p_content->>'assessed_on','')::date, duration_minutes = (p_content->>'duration_minutes')::int,
      instructions = p_content->>'instructions', footer = p_content->>'footer', questions = p_content->'questions',
      total_marks = v_total, display_context = v_context, revision = revision + 1, updated_at = now()
    where id = p_id returning * into v_p;
  end if;
  return v_p;
end $$;

create function public.transition_assessment_paper(p_id uuid, p_revision int, p_action text, p_note text default '')
returns public.assessment_papers language plpgsql security definer set search_path = public as $$
declare v_p public.assessment_papers; v_status text;
begin
  select * into v_p from public.assessment_papers where id = p_id for update;
  if not found or not public.is_school_staff(v_p.school_id) then raise exception 'Not allowed'; end if;
  if p_revision is distinct from v_p.revision then raise exception 'This paper changed. Reload before continuing.'; end if;
  if length(coalesce(p_note,'')) > 5000 then raise exception 'Feedback is too long'; end if;
  if p_action in ('submit','withdraw') then
    if v_p.author_id <> auth.uid() or not public.can_author_paper(v_p.class_id, v_p.subject_id) then raise exception 'Only the assigned author can submit or withdraw'; end if;
    if p_action = 'submit' and v_p.status = 'draft' then
      perform public.paper_question_total(v_p.questions, true);
      if not exists (select 1 from public.school_staff where school_id = v_p.school_id and user_id = v_p.reviewer_id and role = 'admin') then raise exception 'Choose a current reviewer'; end if;
      v_status := 'in_review';
    elsif p_action = 'withdraw' and v_p.status = 'in_review' then v_status := 'draft';
    else raise exception 'Invalid paper transition'; end if;
  elsif p_action in ('approve','return') then
    if not public.is_school_admin(v_p.school_id) or v_p.reviewer_id <> auth.uid() then raise exception 'Only the selected reviewer can review'; end if;
    if v_p.status <> 'in_review' then raise exception 'This paper is not awaiting review'; end if;
    if p_action = 'return' and length(trim(coalesce(p_note,''))) = 0 then raise exception 'Explain the corrections needed'; end if;
    v_status := case when p_action = 'approve' then 'approved' else 'draft' end;
  else raise exception 'Unknown paper action'; end if;
  update public.assessment_papers set status = v_status, revision = revision + 1, updated_at = now(),
    approved_at = case when v_status = 'approved' then now() else null end where id = p_id returning * into v_p;
  insert into public.paper_events(school_id, paper_id, actor_id, action, note)
    values(v_p.school_id, p_id, auth.uid(), p_action, coalesce(p_note,''));
  return v_p;
end $$;

create function public.revise_assessment_paper(p_id uuid)
returns public.assessment_papers language plpgsql security definer set search_path = public as $$
declare v_p public.assessment_papers; v_new public.assessment_papers;
begin
  select * into v_p from public.assessment_papers where id = p_id;
  if not found or v_p.status <> 'approved' or not public.can_author_paper(v_p.class_id, v_p.subject_id)
    or (v_p.author_id <> auth.uid() and not public.is_school_admin(v_p.school_id)) then raise exception 'Not allowed'; end if;
  insert into public.assessment_papers(school_id, author_id, reviewer_id, class_id, subject_id, term_number,
    title, kind, assessed_on, duration_minutes, instructions, footer, questions, total_marks, display_context, revises_id)
  values(v_p.school_id, auth.uid(), v_p.reviewer_id, v_p.class_id, v_p.subject_id, v_p.term_number,
    v_p.title || ' (revision)', v_p.kind, v_p.assessed_on, v_p.duration_minutes, v_p.instructions, v_p.footer,
    v_p.questions, v_p.total_marks, v_p.display_context || jsonb_build_object('author_name', (select full_name from public.profiles where id = auth.uid())), v_p.id)
  returning * into v_new;
  insert into public.paper_events(school_id, paper_id, actor_id, action, note)
    values(v_p.school_id, v_new.id, auth.uid(), 'revised', 'New draft from approved paper ' || p_id);
  return v_new;
end $$;

create function public.link_paper_assessment(p_id uuid, p_revision int, p_assessment_id uuid, p_weight numeric default 1)
returns public.assessment_papers language plpgsql security definer set search_path = public as $$
declare v_p public.assessment_papers; v_a public.assessments; v_id uuid;
begin
  select * into v_p from public.assessment_papers where id = p_id for update;
  if not found or not public.can_author_paper(v_p.class_id, v_p.subject_id)
    or (v_p.author_id <> auth.uid() and not public.is_school_admin(v_p.school_id)) then raise exception 'Not allowed'; end if;
  if v_p.status <> 'approved' then raise exception 'Approve the paper before linking marks'; end if;
  if p_revision is distinct from v_p.revision then raise exception 'This paper changed. Reload before continuing.'; end if;
  if v_p.assessment_id is not null then return v_p; end if;
  if p_assessment_id is null then
    v_id := public.save_assessment(null, v_p.class_id, v_p.subject_id, v_p.term_number, v_p.title,
      v_p.kind, v_p.total_marks, p_weight, v_p.assessed_on);
  else
    select * into v_a from public.assessments where id = p_assessment_id for update;
    if not found or v_a.school_id <> v_p.school_id or v_a.class_id <> v_p.class_id or v_a.subject_id <> v_p.subject_id
      or v_a.term_number <> v_p.term_number or v_a.max_score <> v_p.total_marks then
      raise exception 'Choose an assessment with the same class, subject, term and total marks'; end if;
    v_id := v_a.id;
  end if;
  update public.assessment_papers set assessment_id = v_id, revision = revision + 1, updated_at = now()
    where id = p_id returning * into v_p;
  insert into public.paper_events(school_id, paper_id, actor_id, action) values(v_p.school_id, p_id, auth.uid(), 'linked_assessment');
  return v_p;
end $$;

-- Existing mark capture must not change the meaning of a linked approved paper.
create function public.protect_paper_assessment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.max_score, new.class_id, new.subject_id, new.term_number, new.school_id) is distinct from
     (old.max_score, old.class_id, old.subject_id, old.term_number, old.school_id)
    and exists (select 1 from public.assessment_papers where assessment_id = old.id) then
    raise exception 'This assessment is linked to an approved paper. Create a revised paper and a separate assessment to change its total.';
  end if;
  return new;
end $$;
create trigger protect_paper_assessment before update on public.assessments
  for each row execute function public.protect_paper_assessment();

-- Explicitly restrict callable functions; read policies still protect tables from anonymous access.
revoke all on function public.save_assessment_paper(uuid,int,uuid,jsonb), public.transition_assessment_paper(uuid,int,text,text),
  public.revise_assessment_paper(uuid), public.link_paper_assessment(uuid,int,uuid,numeric),
  public.paper_authoring_options(uuid), public.paper_reviewers(uuid) from public, anon;
grant execute on function public.save_assessment_paper(uuid,int,uuid,jsonb), public.transition_assessment_paper(uuid,int,text,text),
  public.revise_assessment_paper(uuid), public.link_paper_assessment(uuid,int,uuid,numeric),
  public.paper_authoring_options(uuid), public.paper_reviewers(uuid) to authenticated;
