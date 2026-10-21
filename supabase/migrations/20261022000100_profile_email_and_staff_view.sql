-- Staff need to reach parents: keep the sign-in email on the profile.
alter table public.profiles add column if not exists email text not null default '';

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

-- Keep the profile email in step when a user changes their sign-in email.
create or replace function public.handle_auth_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

update public.profiles p set email = u.email
from auth.users u where u.id = p.id and p.email = '';

-- Staff dashboard counts for one school, computed server side.
create or replace function public.school_application_counts(p_school_id uuid)
returns table (status public.application_status, payment_status public.payment_status, total int)
language sql stable security definer set search_path = public as $$
  select a.status, a.payment_status, count(*)::int
  from public.applications a
  where a.school_id = p_school_id and public.is_school_staff(p_school_id)
  group by a.status, a.payment_status;
$$;
