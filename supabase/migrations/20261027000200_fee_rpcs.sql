-- Stage 5 write path. Admins set fees, create accounts and record payments; confirming a payment
-- notifies the parent. All enforce the school admin role.

create or replace function public.generate_fee_reference()
returns text language plpgsql as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; v_i int;
begin
  loop
    v_code := 'FEE-';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.learner_fee_accounts where payment_reference = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public.set_fee_structure(
  p_school_id uuid, p_year int, p_grade text, p_annual numeric, p_discount numeric default 0,
  p_months int default 10, p_terms int default 4
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_admin(p_school_id) then
    raise exception 'Not an administrator' using errcode = 'P0001', hint = 'NOT_ADMIN';
  end if;
  insert into public.fee_structures (school_id, academic_year, grade_code, annual_amount, upfront_discount_percent, months_per_year, terms_per_year)
  values (p_school_id, p_year, p_grade, p_annual, coalesce(p_discount, 0), coalesce(p_months, 10), coalesce(p_terms, 4))
  on conflict (school_id, academic_year, grade_code) do update
    set annual_amount = excluded.annual_amount, upfront_discount_percent = excluded.upfront_discount_percent,
        months_per_year = excluded.months_per_year, terms_per_year = excluded.terms_per_year;
end $$;

-- Create or update a learner's fee account for a year on a plan. total_due comes from the grade's
-- fee structure; the yearly plan applies the upfront discount.
create or replace function public.ensure_fee_account(p_learner_id uuid, p_year int, p_plan public.fee_plan)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_grade text; v_annual numeric; v_disc numeric; v_total numeric; v_id uuid;
begin
  select l.school_id, c.grade_code into v_school, v_grade
  from public.learners l left join public.classes c on c.id = l.current_class_id
  where l.id = p_learner_id;
  if v_school is null or not public.is_school_admin(v_school) then
    raise exception 'Learner not found' using errcode = 'P0002';
  end if;
  if v_grade is null then
    raise exception 'Put the learner in a class first, so Skoolo knows their grade' using errcode = 'P0001', hint = 'NO_GRADE';
  end if;
  select annual_amount, upfront_discount_percent into v_annual, v_disc
  from public.fee_structures where school_id = v_school and academic_year = p_year and grade_code = v_grade;
  if v_annual is null then
    raise exception 'No fee set for this grade and year yet' using errcode = 'P0001', hint = 'NO_FEE';
  end if;
  v_total := case when p_plan = 'year' then round(v_annual * (1 - v_disc / 100), 2) else v_annual end;

  insert into public.learner_fee_accounts (school_id, learner_id, academic_year, plan, total_due, payment_reference)
  values (v_school, p_learner_id, p_year, p_plan, v_total, public.generate_fee_reference())
  on conflict (learner_id, academic_year) do update set plan = excluded.plan, total_due = excluded.total_due
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.ensure_fee_accounts_for_class(p_class_id uuid, p_year int, p_plan public.fee_plan)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record;
begin
  if not public.is_school_admin(public.class_school_id(p_class_id)) then
    raise exception 'Not an administrator' using errcode = 'P0001', hint = 'NOT_ADMIN';
  end if;
  for r in select id from public.learners where current_class_id = p_class_id loop
    perform public.ensure_fee_account(r.id, p_year, p_plan);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.record_fee_payment(
  p_account_id uuid, p_amount numeric, p_method text, p_reference text default null,
  p_paid_on date default current_date, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_acc public.learner_fee_accounts; v_id uuid;
begin
  select * into v_acc from public.learner_fee_accounts where id = p_account_id;
  if not found or not public.is_school_admin(v_acc.school_id) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Enter an amount greater than zero' using errcode = 'P0001', hint = 'BAD_AMOUNT';
  end if;
  insert into public.fee_payments (school_id, account_id, learner_id, amount, method, reference, note, paid_on, recorded_by)
  values (v_acc.school_id, p_account_id, v_acc.learner_id, p_amount, coalesce(p_method, 'eft'), p_reference, p_note, coalesce(p_paid_on, current_date), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.confirm_fee_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay public.fee_payments; v_balance numeric; v_learner text; v_school text; r record;
begin
  select * into v_pay from public.fee_payments where id = p_payment_id;
  if not found or not public.is_school_admin(v_pay.school_id) then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_pay.status = 'confirmed' then return; end if;
  update public.fee_payments set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now() where id = p_payment_id;

  select balance into v_balance from public.fee_account_balances where account_id = v_pay.account_id;
  select first_name || ' ' || last_name into v_learner from public.learners where id = v_pay.learner_id;
  select name into v_school from public.schools where id = v_pay.school_id;
  for r in
    select l.parent_id as uid from public.learners l where l.id = v_pay.learner_id and l.parent_id is not null
    union
    select g.user_id from public.learner_guardians g where g.learner_id = v_pay.learner_id and g.user_id is not null
  loop
    if r.uid is not null then
      insert into public.messages (recipient_id, school_id, subject, body)
      values (r.uid, v_pay.school_id,
        format('Payment received for %s', v_learner),
        format('%s has confirmed a payment of R%s for %s. Your balance is now R%s.', v_school, trim(to_char(v_pay.amount, 'FM999999990.00')), v_learner, trim(to_char(v_balance, 'FM999999990.00'))));
    end if;
  end loop;
end $$;
