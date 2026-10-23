-- Stage 5: school fees. The school sets a fee per grade and a plan (monthly, per term, per year
-- with an optional upfront discount); each learner gets an account with a unique reference; the
-- clerk records payments and the principal confirms them; parents see their statement and balance.
-- Fees are admins and parents only, never teachers. Arrears never block a report card (reports do
-- not consult fees).

-- ---------------------------------------------------------------------------
-- Fee per grade per year.
-- ---------------------------------------------------------------------------
create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year int not null check (academic_year between 2020 and 2100),
  grade_code text not null references public.grades (code),
  annual_amount numeric(12, 2) not null check (annual_amount >= 0),
  upfront_discount_percent numeric(5, 2) not null default 0 check (upfront_discount_percent between 0 and 100),
  months_per_year int not null default 10 check (months_per_year between 1 and 12),
  terms_per_year int not null default 4 check (terms_per_year between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year, grade_code)
);
alter table public.fee_structures enable row level security;
create trigger fee_structures_set_updated_at before update on public.fee_structures
  for each row execute function public.set_updated_at();
create policy "admins manage fee structures" on public.fee_structures for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "staff read fee structures" on public.fee_structures for select
  using (public.is_school_staff(school_id));

-- ---------------------------------------------------------------------------
-- A learner's fee account for a year, and the payments against it.
-- ---------------------------------------------------------------------------
create type public.fee_plan as enum ('monthly', 'term', 'year');
create type public.fee_payment_status as enum ('recorded', 'confirmed');

create table public.learner_fee_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  academic_year int not null,
  plan public.fee_plan not null default 'monthly',
  total_due numeric(12, 2) not null default 0,
  payment_reference text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, academic_year)
);
alter table public.learner_fee_accounts enable row level security;
create trigger learner_fee_accounts_set_updated_at before update on public.learner_fee_accounts
  for each row execute function public.set_updated_at();
create policy "admins manage fee accounts" on public.learner_fee_accounts for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "parents see their child's fee account" on public.learner_fee_accounts for select
  using (public.is_connected_parent(learner_id));

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  account_id uuid not null references public.learner_fee_accounts (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'eft' check (method in ('eft', 'cash')),
  reference text,
  note text,
  paid_on date not null default current_date,
  status public.fee_payment_status not null default 'recorded',
  recorded_by uuid references public.profiles (id),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index fee_payments_account_idx on public.fee_payments (account_id);
alter table public.fee_payments enable row level security;
create policy "admins manage fee payments" on public.fee_payments for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "parents see their child's fee payments" on public.fee_payments for select
  using (public.is_connected_parent(learner_id));

-- Balance per account: due minus confirmed payments. security_invoker, so admins see their
-- school's totals and a parent sees their own child's; the confirmed payments each may read are
-- exactly the ones that count, so the balance is correct for both and leaks nothing.
create or replace view public.fee_account_balances
with (security_invoker = true) as
select
  a.id as account_id, a.school_id, a.learner_id, a.academic_year, a.plan, a.payment_reference, a.total_due,
  coalesce((select sum(p.amount) from public.fee_payments p where p.account_id = a.id and p.status = 'confirmed'), 0) as total_paid,
  a.total_due - coalesce((select sum(p.amount) from public.fee_payments p where p.account_id = a.id and p.status = 'confirmed'), 0) as balance
from public.learner_fee_accounts a;
