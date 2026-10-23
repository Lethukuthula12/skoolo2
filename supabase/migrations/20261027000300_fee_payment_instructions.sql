-- A connected parent's fee statement: reference, balance and the school's bank details for an EFT.
-- Bank details are admin-only on their table, so this SECURITY DEFINER function exposes just what a
-- parent paying their child's fees needs.
create or replace function public.fee_payment_instructions(p_account_id uuid)
returns table (
  payment_reference text, plan public.fee_plan, total_due numeric, total_paid numeric, balance numeric,
  school_name text, account_holder text, bank_name text, branch_code text, account_number text, account_type text,
  monthly numeric, term numeric
) language sql stable security definer set search_path = public as $$
  select
    a.payment_reference, a.plan, b.total_due, b.total_paid, b.balance,
    s.name, bk.account_holder, bk.bank_name, bk.branch_code, bk.account_number, bk.account_type,
    round(fs.annual_amount / nullif(fs.months_per_year, 0), 2) as monthly,
    round(fs.annual_amount / nullif(fs.terms_per_year, 0), 2) as term
  from public.learner_fee_accounts a
  join public.fee_account_balances b on b.account_id = a.id
  join public.schools s on s.id = a.school_id
  left join public.school_bank_accounts bk on bk.school_id = a.school_id
  left join public.learners l on l.id = a.learner_id
  left join public.classes c on c.id = l.current_class_id
  left join public.fee_structures fs on fs.school_id = a.school_id and fs.academic_year = a.academic_year and fs.grade_code = c.grade_code
  where a.id = p_account_id and public.is_connected_parent(a.learner_id);
$$;
