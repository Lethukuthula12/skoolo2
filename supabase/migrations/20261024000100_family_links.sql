-- Stage 2: connect a parent's account to their children. The school gives each learner a family
-- code (shared with the family by WhatsApp); a signed-in parent redeems it and the child appears
-- under "My children". Both parents can redeem the same code. Applicant parents are already linked
-- through the learner's parent_id, so they need no code.

-- A parent account attached to a learner.
alter table public.learner_guardians
  add column if not exists user_id uuid references public.profiles (id) on delete set null;

-- The code the school hands to a family.
alter table public.learners add column if not exists family_code text unique;

create or replace function public.generate_family_code()
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
    exit when not exists (select 1 from public.learners where family_code = v_code);
  end loop;
  return v_code;
end $$;

-- Give every learner in a class a family code (admins only). Returns how many were added.
create or replace function public.set_class_family_codes(p_class_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record;
begin
  if not public.is_school_admin(public.class_school_id(p_class_id)) then
    raise exception 'Not an administrator of this school' using errcode = 'P0001', hint = 'NOT_ADMIN';
  end if;
  for r in select id from public.learners where current_class_id = p_class_id and family_code is null loop
    loop
      begin
        update public.learners set family_code = public.generate_family_code() where id = r.id;
        exit;
      exception when unique_violation then
        -- vanishingly rare race; try another code
      end;
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Replace one learner's code (admins only), invalidating the old one.
create or replace function public.regenerate_family_code(p_learner_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_school_admin(public.learner_school_id(p_learner_id)) then
    raise exception 'Not an administrator of this school' using errcode = 'P0001', hint = 'NOT_ADMIN';
  end if;
  update public.learners set family_code = public.generate_family_code() where id = p_learner_id returning family_code into v_code;
  return v_code;
end $$;

-- A parent redeems a code and is attached to the learner as a guardian account.
create or replace function public.redeem_family_code(p_code text, p_relationship text default '')
returns table (learner_id uuid, first_name text, last_name text, school_name text)
language plpgsql security definer set search_path = public as $$
declare v_learner public.learners;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = 'P0001', hint = 'NOT_SIGNED_IN';
  end if;
  select * into v_learner from public.learners where family_code = upper(trim(p_code));
  if not found then
    raise exception 'That family code was not found' using errcode = 'P0002', hint = 'CODE_NOT_FOUND';
  end if;
  if not exists (select 1 from public.learner_guardians g where g.learner_id = v_learner.id and g.user_id = auth.uid()) then
    insert into public.learner_guardians (learner_id, user_id, full_name, relationship, phone, is_primary)
    values (
      v_learner.id, auth.uid(),
      coalesce((select full_name from public.profiles where id = auth.uid()), ''),
      coalesce(nullif(trim(p_relationship), ''), ''),
      coalesce((select phone from public.profiles where id = auth.uid()), ''),
      false
    );
  end if;
  return query
    select v_learner.id, v_learner.first_name, v_learner.last_name,
           (select name from public.schools where id = v_learner.school_id);
end $$;

-- The learners a signed-in parent is connected to (as applicant parent or linked guardian).
create or replace function public.my_children()
returns table (id uuid, first_name text, last_name text, date_of_birth date, school_name text, class_name text, grade_label text)
language sql stable security definer set search_path = public as $$
  select l.id, l.first_name, l.last_name, l.date_of_birth,
         s.name as school_name, c.name as class_name, g.label as grade_label
  from public.learners l
  left join public.schools s on s.id = l.school_id
  left join public.classes c on c.id = l.current_class_id
  left join public.grades g on g.code = c.grade_code
  where l.parent_id = auth.uid()
     or exists (select 1 from public.learner_guardians lg where lg.learner_id = l.id and lg.user_id = auth.uid())
  order by l.first_name;
$$;

-- Row security: a linked guardian can read their child's learner row and their own guardian rows.
drop policy if exists "linked guardians see learners" on public.learners;
create policy "linked guardians see learners" on public.learners for select
  using (exists (select 1 from public.learner_guardians g where g.learner_id = learners.id and g.user_id = auth.uid()));

drop policy if exists "guardians see their own links" on public.learner_guardians;
create policy "guardians see their own links" on public.learner_guardians for select
  using (user_id = auth.uid());
