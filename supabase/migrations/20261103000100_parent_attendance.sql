-- Let a connected parent read their own child's daily attendance (read-only). Staff still own taking
-- the register; this only opens a per-learner read to the learner's parent or linked guardian.
create or replace function public.is_my_child(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learners l
    where l.id = p_learner_id and (
      l.parent_id = auth.uid()
      or exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.user_id = auth.uid())
    )
  );
$$;

create policy "parents read own child attendance" on public.attendance_records for select
  using (public.is_my_child(learner_id));
