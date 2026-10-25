-- A full-length title must still allow an approved paper to be revised.
create or replace function public.revise_assessment_paper(p_id uuid)
returns public.assessment_papers language plpgsql security definer set search_path = public as $$
declare v_p public.assessment_papers; v_new public.assessment_papers;
begin
  select * into v_p from public.assessment_papers where id = p_id;
  if not found or v_p.status <> 'approved' or not public.can_author_paper(v_p.class_id, v_p.subject_id)
    or (v_p.author_id <> auth.uid() and not public.is_school_admin(v_p.school_id)) then raise exception 'Not allowed'; end if;
  insert into public.assessment_papers(school_id, author_id, reviewer_id, class_id, subject_id, term_number,
    title, kind, assessed_on, duration_minutes, instructions, footer, questions, total_marks, display_context, revises_id)
  values(v_p.school_id, auth.uid(), v_p.reviewer_id, v_p.class_id, v_p.subject_id, v_p.term_number,
    left(v_p.title,189) || ' (revision)', v_p.kind, v_p.assessed_on, v_p.duration_minutes, v_p.instructions, v_p.footer,
    v_p.questions, v_p.total_marks, v_p.display_context || jsonb_build_object('author_name', (select full_name from public.profiles where id = auth.uid())), v_p.id)
  returning * into v_new;
  insert into public.paper_events(school_id, paper_id, actor_id, action, note)
    values(v_p.school_id, v_new.id, auth.uid(), 'revised', 'New draft from approved paper ' || p_id);
  return v_new;
end $$;
