-- Cross-school isolation and role enforcement test.
--
-- Builds two complete schools (A and B), each with an admin, a teacher and a parent with a
-- learner and an application, entirely as the `authenticated` role with per-user JWT claims, so
-- row-level security and the SECURITY DEFINER functions are exercised exactly as a real request
-- does. Then it asserts that neither school can see or change the other's data, that teachers
-- cannot do admin-only actions, that a full grade is refused, that illegal status changes are
-- refused, and that invite codes are single-use, email-bound and expiring.
--
-- Everything runs inside one DO block that always RAISEs at the end, so all test data is rolled
-- back. The final message is the pass/fail sentinel; scripts/test-rls.mjs reads it.
--
-- Run with: npm run test:rls   (from the repo root)

do $$
declare
  v_aA uuid := gen_random_uuid(); v_tA uuid := gen_random_uuid(); v_pA uuid := gen_random_uuid();
  v_aB uuid := gen_random_uuid(); v_tB uuid := gen_random_uuid(); v_pB uuid := gen_random_uuid();
  v_iv uuid := gen_random_uuid(); v_iv2 uuid := gen_random_uuid();
  v_tA2 uuid := gen_random_uuid();
  v_pFam uuid := gen_random_uuid(); v_emailPFam text := 'parent.fam@test.skoolo'; v_famCode text;
  v_emailAA text := 'admin.a@test.skoolo';  v_emailTA text := 'teacher.a@test.skoolo'; v_emailPA text := 'parent.a@test.skoolo';
  v_emailAB text := 'admin.b@test.skoolo';  v_emailTB text := 'teacher.b@test.skoolo'; v_emailPB text := 'parent.b@test.skoolo';
  v_emailIv text := 'invitee@test.skoolo';  v_emailIv2 text := 'invitee2@test.skoolo';
  v_emailTA2 text := 'teacher.a2@test.skoolo';
  v_schoolA uuid; v_schoolB uuid;
  v_periodA uuid; v_periodB uuid; v_pgA uuid; v_pgB uuid;
  v_learnerA uuid; v_learnerA2 uuid; v_learnerB uuid;
  v_appA uuid; v_appB uuid;
  v_staffA uuid; v_staffTA2 uuid; v_code text; v_codeTA2 text; v_codeIv text; v_codeExpired text;
  v_classA uuid; v_subjectA uuid; v_rollLearnerA uuid; v_guardianA uuid; v_reportA uuid;
  v_absenceA uuid; v_threadA uuid;
  v_feeAccountA uuid; v_feePaymentA uuid; v_balance numeric;
  v_slotA uuid; v_breakA uuid; v_lessonA uuid; v_calItemA uuid; v_calStaffOnly uuid; v_attendA uuid;
  v_assess1 uuid; v_assess2 uuid; v_report2 uuid; v_tmark numeric;
  v_checks int := 0; v_fail text[] := '{}'; n int; v_hint text;
begin
  -- 1) Seed auth users (as the privileged connecting role). The trigger creates profiles.
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_aA, v_emailAA, json_build_object('full_name','Admin A','phone','0820000001')),
    (v_tA, v_emailTA, json_build_object('full_name','Teacher A','phone','0820000002')),
    (v_pA, v_emailPA, json_build_object('full_name','Parent A','phone','0820000003')),
    (v_aB, v_emailAB, json_build_object('full_name','Admin B','phone','0820000004')),
    (v_tB, v_emailTB, json_build_object('full_name','Teacher B','phone','0820000005')),
    (v_pB, v_emailPB, json_build_object('full_name','Parent B','phone','0820000006')),
    (v_iv, v_emailIv, json_build_object('full_name','Invitee','phone','0820000007')),
    (v_iv2, v_emailIv2, json_build_object('full_name','Invitee Two','phone','0820000008')),
    (v_tA2, v_emailTA2, json_build_object('full_name','Teacher A2','phone','0820000009')),
    (v_pFam, v_emailPFam, json_build_object('full_name','Family Parent','phone','0820000010'));

  -- From here on, behave as an ordinary authenticated client.
  set local role authenticated;

  -- 2) Build school A (capacity 1 in Grade R so the "full grade" test can bite).
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  select id into v_schoolA from public.create_school('Isolation School A','Town A','Gauteng', null, null, 'GR','G7');
  insert into public.enrolment_periods (school_id, academic_year, name, status, fee_amount, currency)
    values (v_schoolA, 2027, '2027', 'open', 500, 'ZAR') returning id into v_periodA;
  insert into public.period_grades (period_id, grade_code, is_open, capacity)
    values (v_periodA, 'GR', true, 1) returning id into v_pgA;
  insert into public.school_bank_accounts (school_id, account_holder, bank_name, branch_code, account_number)
    values (v_schoolA, 'School A', 'Bank', '000000', '111111');
  insert into public.staff_members (school_id, first_name, last_name, position, email)
    values (v_schoolA, 'Teacher', 'A', 'Teacher', v_emailTA) returning id into v_staffA;
  insert into public.staff_invites (school_id, staff_member_id, email, full_name, role, code)
    values (v_schoolA, v_staffA, v_emailTA, 'Teacher A', 'staff', '') returning code into v_code;

  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  perform public.accept_staff_invite(v_code);   -- teacher A becomes staff of A

  perform set_config('request.jwt.claims', json_build_object('sub', v_pA, 'role','authenticated','email', v_emailPA)::text, true);
  insert into public.learners (parent_id, first_name, last_name, date_of_birth, passport_number)
    values (v_pA, 'Lena', 'A', '2020-01-01', 'PA0001') returning id into v_learnerA;
  insert into public.applications (school_id, period_id, period_grade_id, learner_id, parent_id,
      payment_reference, address_line, town, province)
    values (v_schoolA, v_periodA, v_pgA, v_learnerA, v_pA, 'X', '1 St', 'Town A', 'Gauteng')
    returning id into v_appA;
  insert into public.application_documents (application_id, document_type, storage_path, file_name, mime_type)
    values (v_appA, 'birth_certificate', v_appA || '/birth/f.png', 'f.png', 'image/png');

  -- 2b) Stage 1 register for school A: a second teacher, a class taught by teacher A, a subject,
  --     a school-owned learner in that class and a guardian.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  insert into public.staff_members (school_id, first_name, last_name, position, email)
    values (v_schoolA, 'Teacher', 'A2', 'Teacher', v_emailTA2) returning id into v_staffTA2;
  insert into public.staff_invites (school_id, staff_member_id, email, full_name, role, code)
    values (v_schoolA, v_staffTA2, v_emailTA2, 'Teacher A2', 'staff', '') returning code into v_codeTA2;
  insert into public.classes (school_id, academic_year, grade_code, name, class_teacher_id)
    values (v_schoolA, 2027, 'GR', 'RA', v_staffA) returning id into v_classA;   -- teacher A is class teacher
  insert into public.subjects (school_id, grade_code, name, language_level, sort_order)
    values (v_schoolA, 'GR', 'Home Language', 'home', 1) returning id into v_subjectA;
  insert into public.learners (school_id, current_class_id, first_name, last_name, date_of_birth)
    values (v_schoolA, v_classA, 'Roll', 'Learner', '2019-03-03') returning id into v_rollLearnerA;
  insert into public.learner_guardians (learner_id, full_name, relationship, phone, is_primary)
    values (v_rollLearnerA, 'Mama Roll', 'Mother', '0825550000', true) returning id into v_guardianA;

  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  perform public.accept_staff_invite(v_codeTA2);  -- teacher A2 becomes staff of A, teaching nothing

  -- Family code for the roll learner (for the Stage 2 linking checks).
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  perform public.set_class_family_codes(v_classA);
  select family_code into v_famCode from public.learners where id = v_rollLearnerA;

  -- 3) Build school B.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  select id into v_schoolB from public.create_school('Isolation School B','Town B','Western Cape', null, null, 'GR','G7');
  insert into public.enrolment_periods (school_id, academic_year, name, status, fee_amount, currency)
    values (v_schoolB, 2027, '2027', 'open', 500, 'ZAR') returning id into v_periodB;
  insert into public.period_grades (period_id, grade_code, is_open, capacity)
    values (v_periodB, 'GR', true, 30) returning id into v_pgB;
  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  insert into public.learners (parent_id, first_name, last_name, date_of_birth, passport_number)
    values (v_pB, 'Leo', 'B', '2020-02-02', 'PB0001') returning id into v_learnerB;
  insert into public.applications (school_id, period_id, period_grade_id, learner_id, parent_id,
      payment_reference, address_line, town, province)
    values (v_schoolB, v_periodB, v_pgB, v_learnerB, v_pB, 'X', '2 Rd', 'Town B', 'Western Cape')
    returning id into v_appB;

  -- ===================== ISOLATION: admin B must not see school A =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);

  v_checks := v_checks + 1;
  select count(*) into n from public.applications where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || format('admin B sees %s of A''s applications', n); end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.learners where id = v_learnerA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s learner'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.application_documents where application_id = v_appA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s documents'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.staff_members where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s staff register'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.staff_invites where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s invites'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.school_bank_accounts where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s bank account'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.classes where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s classes'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.subjects where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s subjects'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.learners where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s register learners'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.learner_guardians where id = v_guardianA;
  if n <> 0 then v_fail := v_fail || 'admin B sees A''s learner guardians'::text; end if;

  v_checks := v_checks + 1;
  update public.applications set staff_note = 'hacked' where id = v_appA;
  get diagnostics n = row_count;
  if n <> 0 then v_fail := v_fail || 'admin B updated A''s application'::text; end if;

  v_checks := v_checks + 1;
  begin
    perform public.confirm_application_payment(v_appA);
    v_fail := v_fail || 'admin B confirmed payment on A''s application'::text;
  exception when others then null;  -- expected: not found for this school
  end;

  -- Parent B must not see parent A's learner
  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learners where id = v_learnerA;
  if n <> 0 then v_fail := v_fail || 'parent B sees parent A''s learner'::text; end if;

  -- ===================== ROLE: teacher has no enrolment access =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);

  v_checks := v_checks + 1;
  select count(*) into n from public.applications where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || format('teacher A sees %s applications (enrolment is admin-only)', n); end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.learners where id = v_learnerA;
  if n <> 0 then v_fail := v_fail || 'teacher A sees an applicant learner'::text; end if;

  v_checks := v_checks + 1;
  begin
    perform public.confirm_application_payment(v_appA);
    v_fail := v_fail || 'teacher A confirmed a payment'::text;
  exception when others then null;  -- expected: admin only
  end;

  v_checks := v_checks + 1;
  begin
    perform public.set_application_status(v_appA, 'accepted');
    v_fail := v_fail || 'teacher A changed a status'::text;
  exception when others then null;  -- expected: admin only
  end;

  -- ===================== ROLE: teachers see only their own classes' learners =====================
  -- Teacher A is the class teacher of the class holding the roll learner: must see it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learners where id = v_rollLearnerA;
  if n < 1 then v_fail := v_fail || 'class teacher cannot see a learner in their own class'::text; end if;

  -- Teacher A2 is staff of the same school but teaches no class: must not see that learner.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learners where id = v_rollLearnerA;
  if n <> 0 then v_fail := v_fail || 'a teacher sees a learner in a class they do not teach'::text; end if;

  -- Teacher B (other school) must not see school A's register learner.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tB, 'role','authenticated','email', v_emailTB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learners where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'teacher B sees school A''s register learners'::text; end if;

  -- my_classes() returns only the caller's own classes.
  v_checks := v_checks + 1;
  select count(*) into n from public.my_classes() where id = v_classA;
  if n <> 0 then v_fail := v_fail || 'teacher B''s my_classes includes school A''s class'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.my_classes() where id = v_classA;
  if n < 1 then v_fail := v_fail || 'class teacher''s my_classes omits their own class'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.my_classes();
  if n <> 0 then v_fail := v_fail || 'a teacher with no class gets classes from my_classes'::text; end if;

  -- ===================== STAGE 2: family linking =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);

  v_checks := v_checks + 1;
  begin
    perform public.redeem_family_code('WRONGCOD');
    v_fail := v_fail || 'a wrong family code was accepted'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'CODE_NOT_FOUND' then v_fail := v_fail || format('wrong family code: wrong hint %s', v_hint); end if;
  end;

  v_checks := v_checks + 1;
  begin
    perform public.redeem_family_code(v_famCode, 'Mother');
  exception when others then
    v_fail := v_fail || format('valid family code rejected: %s', sqlerrm);
  end;

  v_checks := v_checks + 1;
  select count(*) into n from public.my_children() where id = v_rollLearnerA;
  if n < 1 then v_fail := v_fail || 'linked parent does not see their child in my_children'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.learners where id = v_rollLearnerA;  -- via the linked-guardian policy
  if n < 1 then v_fail := v_fail || 'linked parent cannot read their child''s learner row'::text; end if;

  -- A different parent is not connected to this child.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.my_children() where id = v_rollLearnerA;
  if n <> 0 then v_fail := v_fail || 'an unrelated parent sees the child in my_children'::text; end if;

  v_checks := v_checks + 1;
  select count(*) into n from public.learners where id = v_rollLearnerA;
  if n <> 0 then v_fail := v_fail || 'an unrelated parent can read the child''s learner row'::text; end if;

  -- The school sees the link.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learner_guardians where learner_id = v_rollLearnerA and user_id is not null;
  if n < 1 then v_fail := v_fail || 'the school does not see the linked guardian account'::text; end if;

  -- ===================== STAGE 3: term reports =====================
  -- Admin A creates the term-1 reports for the class.
  perform public.ensure_term_reports(v_classA, 1);
  select id into v_reportA from public.report_cards where learner_id = v_rollLearnerA and term_number = 1;
  v_checks := v_checks + 1;
  if v_reportA is null then v_fail := v_fail || 'ensure_term_reports did not create a report'::text; end if;

  -- Teacher A (teaches the class) may capture a mark.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.save_mark(v_reportA, v_subjectA, 75);
  exception when others then
    v_fail := v_fail || format('class teacher cannot capture a mark: %s', sqlerrm);
  end;

  -- Teacher A2 (does not teach the class) can neither read nor write it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.report_cards where id = v_reportA;
  if n <> 0 then v_fail := v_fail || 'a teacher sees reports for a class they do not teach'::text; end if;
  v_checks := v_checks + 1;
  begin
    perform public.save_mark(v_reportA, v_subjectA, 10);
    v_fail := v_fail || 'a teacher captured a mark for a class they do not teach'::text;
  exception when others then null;
  end;

  -- Admin B (other school) cannot read or write it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.report_cards where id = v_reportA;
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s report'::text; end if;

  -- The connected parent cannot see the report while it is a draft.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.report_cards where id = v_reportA;
  if n <> 0 then v_fail := v_fail || 'a parent sees a report before it is published'::text; end if;

  -- A teacher cannot approve; an admin can.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.approve_class_reports(v_classA, 1);
    v_fail := v_fail || 'a teacher approved reports'::text;
  exception when others then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  perform public.approve_class_reports(v_classA, 1);
  perform public.publish_class_reports(v_classA, 1);

  -- Now the connected parent can read the published report and its marks.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.report_cards where id = v_reportA;
  if n < 1 then v_fail := v_fail || 'a parent cannot see their child''s published report'::text; end if;
  v_checks := v_checks + 1;
  select count(*) into n from public.report_marks where report_card_id = v_reportA;
  if n < 1 then v_fail := v_fail || 'a parent cannot see the published report''s marks'::text; end if;

  -- An unrelated parent still cannot see the published report.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.report_cards where id = v_reportA;
  if n <> 0 then v_fail := v_fail || 'an unrelated parent sees a published report'::text; end if;

  -- ===================== STAGE 4: absences and messages =====================
  -- The connected parent reports an absence for their child.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  begin
    v_absenceA := public.report_absence(v_rollLearnerA, '2027-02-01', '2027-02-03', 'Flu');
  exception when others then
    v_fail := v_fail || format('connected parent cannot report an absence: %s', sqlerrm);
  end;

  -- An unrelated parent cannot report for this child, nor see the absence.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.report_absence(v_rollLearnerA, '2027-02-01', '2027-02-02', 'x');
    v_fail := v_fail || 'an unrelated parent reported an absence'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'NOT_PARENT' then v_fail := v_fail || format('absence wrong hint: %s', v_hint); end if;
  end;
  v_checks := v_checks + 1;
  select count(*) into n from public.absence_reports where id = v_absenceA;
  if n <> 0 then v_fail := v_fail || 'an unrelated parent sees the absence'::text; end if;

  -- The class teacher sees and acknowledges the absence; a teacher of another class cannot.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.absence_reports where id = v_absenceA;
  if n <> 0 then v_fail := v_fail || 'a teacher sees an absence for a class they do not teach'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.absence_reports where id = v_absenceA;
  if n < 1 then v_fail := v_fail || 'the class teacher cannot see the absence'::text; end if;
  v_checks := v_checks + 1;
  begin
    perform public.acknowledge_absence(v_absenceA);
  exception when others then
    v_fail := v_fail || format('class teacher cannot acknowledge an absence: %s', sqlerrm);
  end;

  -- Threads: the class teacher starts one; the connected parent can read and reply; others cannot.
  v_checks := v_checks + 1;
  begin
    v_threadA := public.start_thread(v_rollLearnerA, 'Reading', 'Please hear your child read tonight.');
  exception when others then
    v_fail := v_fail || format('teacher cannot start a thread: %s', sqlerrm);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.message_threads where id = v_threadA;
  if n < 1 then v_fail := v_fail || 'the connected parent cannot see the thread'::text; end if;
  v_checks := v_checks + 1;
  select count(*) into n from public.thread_messages where thread_id = v_threadA;
  if n < 1 then v_fail := v_fail || 'the connected parent cannot see the thread message'::text; end if;
  v_checks := v_checks + 1;
  begin
    perform public.post_message(v_threadA, 'Thank you, we will.');
  exception when others then
    v_fail := v_fail || format('the connected parent cannot reply: %s', sqlerrm);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.message_threads where id = v_threadA;
  if n <> 0 then v_fail := v_fail || 'an unrelated parent sees the thread'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.message_threads where id = v_threadA;
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s thread'::text; end if;

  -- ===================== STAGE 5: school fees =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  perform public.set_fee_structure(v_schoolA, 2027, 'GR', 12000, 0);
  v_feeAccountA := public.ensure_fee_account(v_rollLearnerA, 2027, 'monthly');
  v_feePaymentA := public.record_fee_payment(v_feeAccountA, 5000, 'eft', 'ENR-X', current_date, null);
  perform public.confirm_fee_payment(v_feePaymentA);

  v_checks := v_checks + 1;
  select balance into v_balance from public.fee_account_balances where account_id = v_feeAccountA;
  if v_balance is distinct from 7000 then v_fail := v_fail || format('wrong balance after payment: %s (expected 7000)', v_balance); end if;

  -- The connected parent sees the account, the payment and the balance.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learner_fee_accounts where id = v_feeAccountA;
  if n < 1 then v_fail := v_fail || 'the parent cannot see their child''s fee account'::text; end if;
  v_checks := v_checks + 1;
  select count(*) into n from public.fee_payments where id = v_feePaymentA;
  if n < 1 then v_fail := v_fail || 'the parent cannot see their child''s payment'::text; end if;
  v_checks := v_checks + 1;
  select balance into v_balance from public.fee_account_balances where account_id = v_feeAccountA;
  if v_balance is distinct from 7000 then v_fail := v_fail || 'the parent sees a wrong balance'::text; end if;

  -- A teacher of the class may not see fees; nor record a payment.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learner_fee_accounts where id = v_feeAccountA;
  if n <> 0 then v_fail := v_fail || 'a teacher sees fee accounts'::text; end if;
  v_checks := v_checks + 1;
  begin
    perform public.record_fee_payment(v_feeAccountA, 100, 'cash');
    v_fail := v_fail || 'a teacher recorded a payment'::text;
  exception when others then null;
  end;

  -- Another school and an unrelated parent see nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learner_fee_accounts where id = v_feeAccountA;
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s fee account'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.learner_fee_accounts where id = v_feeAccountA;
  if n <> 0 then v_fail := v_fail || 'an unrelated parent sees the fee account'::text; end if;

  -- ===================== STAGE 6: timetables and calendars =====================
  -- Admin A sets the day structure: one teaching period and one break.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  insert into public.school_periods (school_id, position, name, starts_at, ends_at, is_break)
    values (v_schoolA, 1, 'Period 1', '08:00', '08:45', false) returning id into v_slotA;
  insert into public.school_periods (school_id, position, name, starts_at, ends_at, is_break)
    values (v_schoolA, 2, 'Break', '08:45', '09:00', true) returning id into v_breakA;

  -- The class teacher (Grade R, a class-teacher grade) places one of their lessons.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  begin
    v_lessonA := public.place_lesson(v_classA, v_subjectA, v_slotA, 1);
  exception when others then
    v_fail := v_fail || format('class teacher cannot place a lesson: %s', sqlerrm);
  end;

  -- A teacher who does not teach the class cannot place its lessons.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.place_lesson(v_classA, v_subjectA, v_slotA, 2);
    v_fail := v_fail || 'a teacher placed a lesson for a class they do not teach'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'NOT_YOUR_CLASS' then v_fail := v_fail || format('wrong-class wrong hint: %s', v_hint); end if;
  end;

  -- A clash in the same slot is refused.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.place_lesson(v_classA, v_subjectA, v_slotA, 1);
    v_fail := v_fail || 'a clashing lesson was accepted'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint not in ('TEACHER_BUSY', 'CLASS_BUSY') then v_fail := v_fail || format('clash wrong hint: %s', v_hint); end if;
  end;

  -- A break period cannot hold a lesson.
  v_checks := v_checks + 1;
  begin
    perform public.place_lesson(v_classA, v_subjectA, v_breakA, 3);
    v_fail := v_fail || 'a lesson was placed in a break'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'BAD_PERIOD' then v_fail := v_fail || format('break wrong hint: %s', v_hint); end if;
  end;

  -- my_timetable returns the teacher's own lesson.
  v_checks := v_checks + 1;
  select count(*) into n from public.my_timetable(2027) where id = v_lessonA;
  if n < 1 then v_fail := v_fail || 'the teacher''s my_timetable omits their lesson'::text; end if;

  -- Another teacher (same school) cannot see the lesson row, nor remove it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.timetable_lessons where id = v_lessonA;
  if n <> 0 then v_fail := v_fail || 'a teacher sees another teacher''s lesson'::text; end if;
  v_checks := v_checks + 1;
  begin
    perform public.remove_lesson(v_lessonA);
    v_fail := v_fail || 'a teacher removed another teacher''s lesson'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'NOT_YOURS' then v_fail := v_fail || format('remove wrong hint: %s', v_hint); end if;
  end;

  -- Another school sees neither the periods nor the lesson, and its my_timetable excludes it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tB, 'role','authenticated','email', v_emailTB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.my_timetable(2027) where id = v_lessonA;
  if n <> 0 then v_fail := v_fail || 'teacher B''s my_timetable includes school A''s lesson'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.school_periods where school_id = v_schoolA;
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s periods'::text; end if;
  v_checks := v_checks + 1;
  select count(*) into n from public.timetable_lessons where id = v_lessonA;
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s lesson'::text; end if;

  -- Admin A oversees their school's whole timetable.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.timetable_lessons where id = v_lessonA;
  if n < 1 then v_fail := v_fail || 'admin A cannot see their school''s timetable'::text; end if;

  -- Shared school calendar: any staff member adds; all staff see; connected parents see the
  -- parent-visible events only; another school sees nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  begin
    insert into public.calendar_items (school_id, class_id, subject_id, title, kind, event_date)
      values (v_schoolA, v_classA, v_subjectA, 'Spelling test', 'test', '2027-02-10') returning id into v_calItemA;
  exception when others then
    v_fail := v_fail || format('a teacher cannot add a calendar event: %s', sqlerrm);
  end;

  -- An admin (no staff row) posts a staff-only event.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  v_checks := v_checks + 1;
  begin
    insert into public.calendar_items (school_id, title, kind, event_date, parent_visible)
      values (v_schoolA, 'Staff meeting', 'event', '2027-02-11', false) returning id into v_calStaffOnly;
  exception when others then
    v_fail := v_fail || format('an admin cannot add a calendar event: %s', sqlerrm);
  end;

  -- Another teacher at the school sees both events (shared).
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.calendar_items where id in (v_calItemA, v_calStaffOnly);
  if n < 2 then v_fail := v_fail || 'a teacher does not see the shared school calendar'::text; end if;

  -- The connected parent sees the parent-visible event but not the staff-only one.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.calendar_items where id = v_calItemA;
  if n < 1 then v_fail := v_fail || 'a connected parent cannot see a parent-visible event'::text; end if;
  v_checks := v_checks + 1;
  select count(*) into n from public.calendar_items where id = v_calStaffOnly;
  if n <> 0 then v_fail := v_fail || 'a parent sees a staff-only event'::text; end if;

  -- An unrelated parent and another school see nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pB, 'role','authenticated','email', v_emailPB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.calendar_items where id in (v_calItemA, v_calStaffOnly);
  if n <> 0 then v_fail := v_fail || 'an unrelated parent sees another school''s calendar'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.calendar_items where id in (v_calItemA, v_calStaffOnly);
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s calendar'::text; end if;

  -- A teacher from another school cannot add an event to school A.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tB, 'role','authenticated','email', v_emailTB)::text, true);
  v_checks := v_checks + 1;
  begin
    insert into public.calendar_items (school_id, title, kind, event_date) values (v_schoolA, 'Sneaky', 'event', '2027-03-01');
    v_fail := v_fail || 'a teacher from another school added an event'::text;
  exception when others then null;
  end;

  -- ===================== STAGE 7: assessment detail =====================
  -- Teacher A (the class teacher) captures two weighted assessments for Term 2 and the roll learner's
  -- scores. The term mark must be their weighted average: (75*1 + 80*3) / 4 = 78.75.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  begin
    v_assess1 := public.save_assessment(null, v_classA, v_subjectA, 2, 'Test 1', 'test', 20, 1, null);
    v_assess2 := public.save_assessment(null, v_classA, v_subjectA, 2, 'Project', 'project', 50, 3, null);
  exception when others then
    v_fail := v_fail || format('teacher cannot create assessments: %s', sqlerrm);
  end;

  v_checks := v_checks + 1;
  begin
    perform public.save_assessment_score(v_assess1, v_rollLearnerA, 15, false);  -- 15/20 = 75%
    perform public.save_assessment_score(v_assess2, v_rollLearnerA, 40, false);  -- 40/50 = 80%
  exception when others then
    v_fail := v_fail || format('teacher cannot capture scores: %s', sqlerrm);
  end;

  -- the computed mark landed in a fresh draft Term 2 report
  select id into v_report2 from public.report_cards
    where learner_id = v_rollLearnerA and academic_year = 2027 and term_number = 2;
  v_checks := v_checks + 1;
  if v_report2 is null then
    v_fail := v_fail || 'assessments did not create a term 2 report'::text;
  else
    select mark into v_tmark from public.report_marks where report_card_id = v_report2 and subject_id = v_subjectA;
    v_checks := v_checks + 1;
    if v_tmark is distinct from 78.75 then
      v_fail := v_fail || format('computed term mark %s, expected 78.75', v_tmark);
    end if;
  end if;

  -- a score over the maximum is refused
  v_checks := v_checks + 1;
  begin
    perform public.save_assessment_score(v_assess1, v_rollLearnerA, 25, false);  -- max is 20
    v_fail := v_fail || 'a score over the maximum was accepted'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'OVER_MAX' then v_fail := v_fail || format('over-max wrong hint: %s', v_hint); end if;
  end;

  -- a teacher of another class sees nothing and cannot capture for this class
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.assessments where id = v_assess1;
  if n <> 0 then v_fail := v_fail || 'a teacher sees assessments for a class they do not teach'::text; end if;
  v_checks := v_checks + 1;
  select count(*) into n from public.assessment_scores where assessment_id = v_assess1;
  if n <> 0 then v_fail := v_fail || 'a teacher sees assessment scores for a class they do not teach'::text; end if;
  v_checks := v_checks + 1;
  begin
    perform public.save_assessment(null, v_classA, v_subjectA, 2, 'Sneaky', 'test', 10, 1, null);
    v_fail := v_fail || 'a teacher created an assessment for a class they do not teach'::text;
  exception when others then null;
  end;

  -- another school and the connected parent see no assessment detail
  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.assessments where id = v_assess1;
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s assessments'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.assessments where id = v_assess1;
  if n <> 0 then v_fail := v_fail || 'a parent sees assessments'::text; end if;
  v_checks := v_checks + 1;
  select count(*) into n from public.assessment_scores where assessment_id = v_assess1;
  if n <> 0 then v_fail := v_fail || 'a parent sees assessment scores'::text; end if;

  -- ===================== ATTENDANCE REGISTER =====================
  -- The class teacher marks the roll learner present.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA, 'role','authenticated','email', v_emailTA)::text, true);
  v_checks := v_checks + 1;
  begin
    insert into public.attendance_records (class_id, learner_id, attendance_date, status)
      values (v_classA, v_rollLearnerA, '2027-02-01', 'present') returning id into v_attendA;
  exception when others then
    v_fail := v_fail || format('class teacher cannot take the register: %s', sqlerrm);
  end;

  -- A learner who is not in the class cannot be marked.
  v_checks := v_checks + 1;
  begin
    insert into public.attendance_records (class_id, learner_id, attendance_date, status)
      values (v_classA, v_learnerA, '2027-02-01', 'absent');
    v_fail := v_fail || 'attendance accepted for a learner not in the class'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'NOT_IN_CLASS' then v_fail := v_fail || format('not-in-class wrong hint: %s', v_hint); end if;
  end;

  -- A teacher of another class cannot see or mark it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tA2, 'role','authenticated','email', v_emailTA2)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.attendance_records where id = v_attendA;
  if n <> 0 then v_fail := v_fail || 'a teacher sees attendance for a class they do not teach'::text; end if;

  -- Another school and a connected parent see no attendance.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aB, 'role','authenticated','email', v_emailAB)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.attendance_records where id = v_attendA;
  if n <> 0 then v_fail := v_fail || 'admin B sees school A''s attendance'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_pFam, 'role','authenticated','email', v_emailPFam)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.attendance_records where id = v_attendA;
  if n <> 0 then v_fail := v_fail || 'a parent sees attendance'::text; end if;

  -- Admin A reads the register for their school.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.attendance_records where id = v_attendA;
  if n < 1 then v_fail := v_fail || 'admin A cannot see the register'::text; end if;

  -- ===================== BUSINESS RULES (as admin / parent A) =====================
  -- Full grade: Grade R capacity is 1 and already taken.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pA, 'role','authenticated','email', v_emailPA)::text, true);
  insert into public.learners (parent_id, first_name, last_name, date_of_birth, passport_number)
    values (v_pA, 'Lena2', 'A', '2021-01-01', 'PA0002') returning id into v_learnerA2;
  v_checks := v_checks + 1;
  begin
    insert into public.applications (school_id, period_id, period_grade_id, learner_id, parent_id,
        payment_reference, address_line, town, province)
      values (v_schoolA, v_periodA, v_pgA, v_learnerA2, v_pA, 'X', '1 St', 'Town A', 'Gauteng');
    v_fail := v_fail || 'full grade accepted a second application'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'GRADE_FULL' then v_fail := v_fail || format('full grade wrong hint: %s / %s', v_hint, sqlerrm); end if;
  end;

  -- Illegal status transition: decline, then try to accept.
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  perform public.set_application_status(v_appA, 'declined');  -- allowed
  v_checks := v_checks + 1;
  begin
    perform public.set_application_status(v_appA, 'accepted'); -- declined -> accepted is illegal
    v_fail := v_fail || 'illegal status transition accepted'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'INVALID_TRANSITION' then v_fail := v_fail || format('transition wrong hint: %s / %s', v_hint, sqlerrm); end if;
  end;

  -- ===================== INVITE LIFECYCLE =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  insert into public.staff_invites (school_id, email, full_name, role, code)
    values (v_schoolA, v_emailIv, 'Invitee', 'staff', '') returning code into v_codeIv;
  insert into public.staff_invites (school_id, email, full_name, role, code, expires_at)
    values (v_schoolA, v_emailIv2, 'Invitee Two', 'staff', '', now() - interval '1 day')
    returning code into v_codeExpired;

  -- Wrong email cannot redeem
  perform set_config('request.jwt.claims', json_build_object('sub', v_iv, 'role','authenticated','email', 'someone.else@test.skoolo')::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.accept_staff_invite(v_codeIv);
    v_fail := v_fail || 'invite redeemed with the wrong email'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'INVITE_EMAIL_MISMATCH' then v_fail := v_fail || format('mismatch wrong hint: %s', v_hint); end if;
  end;

  -- Correct email redeems once
  perform set_config('request.jwt.claims', json_build_object('sub', v_iv, 'role','authenticated','email', v_emailIv)::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.accept_staff_invite(v_codeIv);
  exception when others then
    v_fail := v_fail || format('valid invite rejected: %s', sqlerrm);
  end;

  -- ...but not twice
  v_checks := v_checks + 1;
  begin
    perform public.accept_staff_invite(v_codeIv);
    v_fail := v_fail || 'invite redeemed twice'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'INVITE_USED' then v_fail := v_fail || format('reuse wrong hint: %s', v_hint); end if;
  end;

  -- Expired invite is refused
  perform set_config('request.jwt.claims', json_build_object('sub', v_iv2, 'role','authenticated','email', v_emailIv2)::text, true);
  v_checks := v_checks + 1;
  begin
    perform public.accept_staff_invite(v_codeExpired);
    v_fail := v_fail || 'expired invite redeemed'::text;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint <> 'INVITE_EXPIRED' then v_fail := v_fail || format('expiry wrong hint: %s', v_hint); end if;
  end;

  -- ===================== POSITIVE CONTROLS =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_aA, 'role','authenticated','email', v_emailAA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.applications where school_id = v_schoolA;
  if n < 1 then v_fail := v_fail || 'admin A cannot read own applications'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_pA, 'role','authenticated','email', v_emailPA)::text, true);
  v_checks := v_checks + 1;
  select count(*) into n from public.applications where parent_id = v_pA;
  if n < 1 then v_fail := v_fail || 'parent A cannot read own application'::text; end if;

  -- ===================== RESULT (always rolls back) =====================
  if array_length(v_fail, 1) is null then
    raise exception 'SKOOLO_RLS_TESTS_PASSED: % checks passed', v_checks;
  else
    raise exception 'SKOOLO_RLS_TESTS_FAILED (% of % failed): %',
      array_length(v_fail, 1), v_checks, array_to_string(v_fail, ' | ');
  end if;
end $$;
