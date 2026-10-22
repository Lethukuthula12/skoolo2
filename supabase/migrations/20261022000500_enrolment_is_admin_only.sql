-- Enrolment is admin work. Teachers (role 'staff') have no business in the applications queue or
-- anything attached to it. Every application-adjacent read moves from is_school_staff (any staff)
-- to is_school_admin. Teachers keep nothing here; their own tools come with later stages.

drop policy if exists "staff see school applications" on public.applications;
create policy "admins see school applications" on public.applications for select
  using (public.is_school_admin(school_id));

drop policy if exists "staff see school history" on public.application_status_history;
create policy "admins see school history" on public.application_status_history for select
  using (exists (select 1 from public.applications a where a.id = application_id and public.is_school_admin(a.school_id)));

drop policy if exists "staff see school documents" on public.application_documents;
create policy "admins see school documents" on public.application_documents for select
  using (exists (select 1 from public.applications a where a.id = application_id and public.is_school_admin(a.school_id)));

drop policy if exists "staff see applicant profiles" on public.profiles;
create policy "admins see applicant profiles" on public.profiles for select
  using (exists (select 1 from public.applications a where a.parent_id = profiles.id and public.is_school_admin(a.school_id)));

drop policy if exists "staff see school learners" on public.learners;
create policy "admins see school learners" on public.learners for select
  using (exists (select 1 from public.applications a where a.learner_id = learners.id and public.is_school_admin(a.school_id)));

drop policy if exists "staff message school applicants" on public.messages;
create policy "admins message school applicants" on public.messages for insert
  with check (
    school_id is not null and public.is_school_admin(school_id)
    and (application_id is null or exists (
      select 1 from public.applications a where a.id = application_id and a.school_id = messages.school_id and a.parent_id = recipient_id))
  );

drop policy if exists "staff see messages they sent to applicants" on public.messages;
create policy "admins see messages they sent to applicants" on public.messages for select
  using (school_id is not null and public.is_school_admin(school_id));

drop policy if exists "staff read school application files" on storage.objects;
create policy "admins read school application files" on storage.objects for select to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (select 1 from public.applications a
                where a.id::text = (storage.foldername(name))[1] and public.is_school_admin(a.school_id))
  );
