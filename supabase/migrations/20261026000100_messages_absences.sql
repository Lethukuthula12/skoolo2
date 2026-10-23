-- Stage 4: messages between home and school, and absence reporting. Everything is keyed to a
-- learner: the people who may see it are the school's admins, the teachers of the learner's class,
-- and the learner's connected parents. Writes go through functions that enforce this.

-- Who may see a learner's messages and absences.
create or replace function public.can_access_learner(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learners l
    where l.id = p_learner_id and (
      public.is_school_admin(l.school_id)
      or (l.current_class_id is not null and public.teaches_class(l.current_class_id))
      or l.parent_id = auth.uid()
      or exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.user_id = auth.uid())
    )
  );
$$;

create or replace function public.is_connected_parent(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learners l
    where l.id = p_learner_id and (
      l.parent_id = auth.uid()
      or exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.user_id = auth.uid())
    )
  );
$$;

create or replace function public.is_learner_staff(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learners l
    where l.id = p_learner_id and (
      public.is_school_admin(l.school_id)
      or (l.current_class_id is not null and public.teaches_class(l.current_class_id))
    )
  );
$$;

-- Notify a learner's class teachers and the school admins through the inbox.
create or replace function public.notify_learner_staff(p_learner_id uuid, p_subject text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_class uuid; r record;
begin
  select school_id, current_class_id into v_school, v_class from public.learners where id = p_learner_id;
  for r in
    select sm.user_id as uid from public.classes c join public.staff_members sm on sm.id = c.class_teacher_id
      where c.id = v_class and sm.user_id is not null
    union
    select sm.user_id from public.class_subject_teachers cst join public.staff_members sm on sm.id = cst.teacher_id
      where cst.class_id = v_class and sm.user_id is not null
    union
    select ss.user_id from public.school_staff ss where ss.school_id = v_school and ss.role = 'admin'
  loop
    if r.uid is not null then
      insert into public.messages (recipient_id, school_id, subject, body) values (r.uid, v_school, p_subject, p_body);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Absence reports
-- ---------------------------------------------------------------------------
create type public.absence_status as enum ('reported', 'acknowledged');

create table public.absence_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  reported_by uuid references public.profiles (id),
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  note text,
  document_path text,
  status public.absence_status not null default 'reported',
  acknowledged_by uuid references public.profiles (id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index absence_reports_learner_idx on public.absence_reports (learner_id);
create index absence_reports_school_status_idx on public.absence_reports (school_id, status);
alter table public.absence_reports enable row level security;
create policy "see absences for learners you are entitled to" on public.absence_reports for select
  using (public.can_access_learner(learner_id));

create or replace function public.report_absence(
  p_learner_id uuid, p_start date, p_end date, p_reason text, p_note text default null, p_document_path text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_school uuid; v_learner text; v_parent text;
begin
  if not public.is_connected_parent(p_learner_id) then
    raise exception 'You can only report an absence for your own child' using errcode = 'P0001', hint = 'NOT_PARENT';
  end if;
  select school_id into v_school from public.learners where id = p_learner_id;
  insert into public.absence_reports (school_id, learner_id, reported_by, start_date, end_date, reason, note, document_path)
  values (v_school, p_learner_id, auth.uid(), p_start, p_end, coalesce(p_reason, ''), p_note, p_document_path)
  returning id into v_id;

  select first_name || ' ' || last_name into v_learner from public.learners where id = p_learner_id;
  select coalesce(full_name, 'A parent') into v_parent from public.profiles where id = auth.uid();
  perform public.notify_learner_staff(p_learner_id,
    format('Absence reported: %s', v_learner),
    format('%s reported %s absent from %s to %s. %s', v_parent, v_learner, p_start, p_end, coalesce(p_reason, '')));
  return v_id;
end $$;

create or replace function public.acknowledge_absence(p_absence_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ab public.absence_reports; v_learner text; v_school text;
begin
  select * into v_ab from public.absence_reports where id = p_absence_id;
  if not found or not public.is_learner_staff(v_ab.learner_id) then
    raise exception 'Absence not found' using errcode = 'P0002';
  end if;
  update public.absence_reports set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now()
  where id = p_absence_id;

  select first_name || ' ' || last_name into v_learner from public.learners where id = v_ab.learner_id;
  select name into v_school from public.schools where id = v_ab.school_id;
  if v_ab.reported_by is not null then
    insert into public.messages (recipient_id, school_id, subject, body)
    values (v_ab.reported_by, v_ab.school_id,
      format('Absence noted for %s', v_learner),
      format('%s has noted %s''s absence from %s to %s. Thank you for letting us know.', v_school, v_learner, v_ab.start_date, v_ab.end_date));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Two-way message threads about a learner
-- ---------------------------------------------------------------------------
create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  subject text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index message_threads_learner_idx on public.message_threads (learner_id, last_message_at desc);
alter table public.message_threads enable row level security;
create policy "see threads for learners you are entitled to" on public.message_threads for select
  using (public.can_access_learner(learner_id));

create table public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  sender_id uuid references public.profiles (id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index thread_messages_thread_idx on public.thread_messages (thread_id, created_at);
alter table public.thread_messages enable row level security;

create or replace function public.thread_learner(p_thread_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select learner_id from public.message_threads where id = p_thread_id;
$$;
create policy "see thread messages you are entitled to" on public.thread_messages for select
  using (public.can_access_learner(public.thread_learner(thread_id)));

-- Start a thread about a learner (a staff member of the class, or a connected parent).
create or replace function public.start_thread(p_learner_id uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_school uuid;
begin
  if not public.can_access_learner(p_learner_id) then
    raise exception 'You cannot message about this learner' using errcode = 'P0001', hint = 'NO_ACCESS';
  end if;
  select school_id into v_school from public.learners where id = p_learner_id;
  insert into public.message_threads (school_id, learner_id, subject, created_by)
  values (v_school, p_learner_id, coalesce(nullif(trim(p_subject), ''), 'Message'), auth.uid())
  returning id into v_id;
  insert into public.thread_messages (thread_id, sender_id, body) values (v_id, auth.uid(), p_body);
  perform public.notify_thread_counterparts(v_id, p_body);
  return v_id;
end $$;

create or replace function public.post_message(p_thread_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_learner uuid;
begin
  select learner_id into v_learner from public.message_threads where id = p_thread_id;
  if v_learner is null or not public.can_access_learner(v_learner) then
    raise exception 'Thread not found' using errcode = 'P0002';
  end if;
  insert into public.thread_messages (thread_id, sender_id, body) values (p_thread_id, auth.uid(), p_body);
  update public.message_threads set last_message_at = now() where id = p_thread_id;
  perform public.notify_thread_counterparts(p_thread_id, p_body);
end $$;

-- Notify the other side of a thread through the inbox: if a parent posted, tell the staff; if staff
-- posted, tell the connected parents.
create or replace function public.notify_thread_counterparts(p_thread_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_learner uuid; v_school uuid; v_name text; r record;
begin
  select learner_id, school_id into v_learner, v_school from public.message_threads where id = p_thread_id;
  select first_name || ' ' || last_name into v_name from public.learners where id = v_learner;
  if public.is_connected_parent(v_learner) then
    perform public.notify_learner_staff(v_learner, format('Message about %s', v_name), left(p_body, 140));
  else
    for r in
      select l.parent_id as uid from public.learners l where l.id = v_learner and l.parent_id is not null
      union
      select g.user_id from public.learner_guardians g where g.learner_id = v_learner and g.user_id is not null
    loop
      if r.uid is not null then
        insert into public.messages (recipient_id, school_id, subject, body)
        values (r.uid, v_school, format('Message about %s', v_name), left(p_body, 140));
      end if;
    end loop;
  end if;
end $$;

-- A teacher or admin messages every family in a class (one private thread per learner).
create or replace function public.message_class(p_class_id uuid, p_subject text, p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record;
begin
  if not (public.is_school_admin(public.class_school_id(p_class_id)) or public.teaches_class(p_class_id)) then
    raise exception 'You cannot message this class' using errcode = 'P0001', hint = 'NO_ACCESS';
  end if;
  for r in select id from public.learners where current_class_id = p_class_id loop
    perform public.start_thread(r.id, p_subject, p_body);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Private bucket for absence notes (e.g. a doctor's note). Parents upload for their child; the
-- learner's class staff read. Path: <school_id>/<learner_id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('absence-notes', 'absence-notes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "parents upload absence notes for their child" on storage.objects for insert to authenticated
  with check (bucket_id = 'absence-notes' and public.is_connected_parent(((storage.foldername(name))[2])::uuid));
create policy "see absence notes you are entitled to" on storage.objects for select to authenticated
  using (bucket_id = 'absence-notes' and public.can_access_learner(((storage.foldername(name))[2])::uuid));
