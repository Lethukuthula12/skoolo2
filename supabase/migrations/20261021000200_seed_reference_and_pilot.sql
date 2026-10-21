-- Reference data and the pilot seed. Idempotent so it can be re-run safely.

insert into public.grades (code, label, sort_order) values
  ('G00', 'Grade 00 (Preschool)', 0),
  ('GRR', 'Grade RR', 1),
  ('GR',  'Grade R', 2),
  ('G1',  'Grade 1', 3),
  ('G2',  'Grade 2', 4),
  ('G3',  'Grade 3', 5),
  ('G4',  'Grade 4', 6),
  ('G5',  'Grade 5', 7),
  ('G6',  'Grade 6', 8),
  ('G7',  'Grade 7', 9),
  ('G8',  'Grade 8', 10),
  ('G9',  'Grade 9', 11),
  ('G10', 'Grade 10', 12),
  ('G11', 'Grade 11', 13),
  ('G12', 'Grade 12', 14)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order;

-- Pilot school. Town, province, contact details, fee and bank details are placeholders until
-- the school supplies them (expected 2026-10-22). Everything marked TODO is a placeholder.
insert into public.schools (id, slug, name, tagline, description, town, province, lowest_grade, highest_grade, is_verified, is_claimed)
values (
  'a0000000-0000-4000-8000-000000000001',
  'newborn-christian-school',
  'Newborn Christian School',
  'A Christ-centred foundation from Preschool to Grade 7',
  'Newborn Christian School offers a nurturing, values-driven education from Grade 00 through Grade 7.', -- TODO confirm wording with the school
  'TODO town',
  'Gauteng', -- TODO confirm province
  'G00', 'G7',
  true, true
)
on conflict (id) do update set
  name = excluded.name, slug = excluded.slug, lowest_grade = excluded.lowest_grade,
  highest_grade = excluded.highest_grade, is_verified = true, is_claimed = true;

insert into public.school_bank_accounts (school_id, account_holder, bank_name, branch_code, account_number, account_type)
values ('a0000000-0000-4000-8000-000000000001', 'Newborn Christian School', 'TODO bank', '000000', '0000000000', 'Cheque')
on conflict (school_id) do nothing;

insert into public.enrolment_periods (id, school_id, academic_year, name, status, opens_at, closes_at, fee_amount, currency, instructions)
values (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  2027, '2027 Enrolment', 'open', '2026-10-01', '2026-12-15',
  500.00, 'ZAR', -- TODO confirm fee
  'Please use the payment reference exactly as shown so the school can match your payment.'
)
on conflict (school_id, academic_year) do update set status = 'open', fee_amount = excluded.fee_amount;

insert into public.period_grades (period_id, grade_code, is_open, capacity)
select 'b0000000-0000-4000-8000-000000000001', g.code, true,
       case g.code when 'G00' then 20 when 'GRR' then 20 when 'GR' then 25 else 30 end -- TODO confirm capacities
from public.grades g
where g.sort_order between 0 and 9
on conflict (period_id, grade_code) do nothing;

-- Directory filler: real independent schools, unclaimed, so browsing and search feel complete.
-- Public facts only (name, town, province, grade range). None of these can accept applications
-- until they claim their listing.
insert into public.schools (slug, name, town, province, lowest_grade, highest_grade, is_verified, is_claimed) values
  ('st-johns-college-johannesburg', 'St John''s College', 'Houghton, Johannesburg', 'Gauteng', 'G00', 'G12', false, false),
  ('roedean-school', 'Roedean School (SA)', 'Parktown, Johannesburg', 'Gauteng', 'G00', 'G12', false, false),
  ('st-stithians-college', 'St Stithians College', 'Randburg, Johannesburg', 'Gauteng', 'G00', 'G12', false, false),
  ('kingsmead-college', 'Kingsmead College', 'Melrose, Johannesburg', 'Gauteng', 'G00', 'G12', false, false),
  ('st-marys-school-waverley', 'St Mary''s School, Waverley', 'Waverley, Johannesburg', 'Gauteng', 'G00', 'G12', false, false),
  ('crawford-international-sandton', 'Crawford International Sandton', 'Sandton', 'Gauteng', 'G00', 'G12', false, false),
  ('reddam-house-waterfall', 'Reddam House Waterfall', 'Waterfall, Midrand', 'Gauteng', 'G00', 'G12', false, false),
  ('curro-aurora', 'Curro Aurora', 'Randburg, Johannesburg', 'Gauteng', 'G00', 'G12', false, false),
  ('st-albans-college', 'St Alban''s College', 'Lynnwood Glen, Pretoria', 'Gauteng', 'G8', 'G12', false, false),
  ('st-marys-diocesan-school-pretoria', 'St Mary''s Diocesan School for Girls', 'Hillcrest, Pretoria', 'Gauteng', 'G00', 'G12', false, false),
  ('bishops-diocesan-college', 'Bishops Diocesan College', 'Rondebosch, Cape Town', 'Western Cape', 'GR', 'G12', false, false),
  ('herschel-girls-school', 'Herschel Girls School', 'Claremont, Cape Town', 'Western Cape', 'G00', 'G12', false, false),
  ('reddam-house-constantia', 'Reddam House Constantia', 'Constantia, Cape Town', 'Western Cape', 'G00', 'G12', false, false),
  ('hilton-college', 'Hilton College', 'Hilton', 'KwaZulu-Natal', 'G8', 'G12', false, false),
  ('durban-girls-college', 'Durban Girls'' College', 'Berea, Durban', 'KwaZulu-Natal', 'G00', 'G12', false, false),
  ('clifton-school-durban', 'Clifton School', 'Morningside, Durban', 'KwaZulu-Natal', 'G00', 'G12', false, false),
  ('st-andrews-college-makhanda', 'St Andrew''s College', 'Makhanda', 'Eastern Cape', 'G8', 'G12', false, false),
  ('st-andrews-school-bloemfontein', 'St Andrew''s School', 'Bloemfontein', 'Free State', 'G00', 'G12', false, false),
  ('stanford-lake-college', 'Stanford Lake College', 'Haenertsburg', 'Limpopo', 'G8', 'G12', false, false),
  ('uplands-college', 'Uplands College', 'White River', 'Mpumalanga', 'G00', 'G12', false, false)
on conflict (slug) do nothing;
