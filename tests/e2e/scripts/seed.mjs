import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { API_URL, DB_URL, assertLocalApi, assertLocalDatabase } from './local-safety.mjs';

export async function seed(status) {
  assertLocalApi(status.API_URL); assertLocalDatabase(status.DB_URL);
  const accounts = JSON.parse(await readFile(new URL('../fixtures/accounts.json', import.meta.url), 'utf8'));
  const users = {};
  for (const [role, email] of Object.entries(accounts)) {
    if (role === 'password') continue;
    const response = await fetch(API_URL + '/auth/v1/admin/users', {
      method: 'POST', headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: accounts.password, email_confirm: true, user_metadata: { full_name: `Test ${role}`, phone: '0820000000' } }),
    });
    if (!response.ok) throw new Error(`Could not create fictional account ${role}: HTTP ${response.status}. Run local:reset.`);
    const user = await response.json(); users[role] = user.id;
  }
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    // The historical migration seeds a pilot school. Remove that local-only copy before fixtures.
    await client.query("delete from public.schools where id = 'a0000000-0000-4000-8000-000000000001'");
    const year = new Date().getFullYear();
    for (const letter of ['A', 'B']) {
      const n = letter === 'A' ? '1' : '2';
      const school = `e0000000-0000-4000-8000-00000000000${n}`;
      const staff = `e1000000-0000-4000-8000-00000000000${n}`;
      const classroom = `e2000000-0000-4000-8000-00000000000${n}`;
      const learner = `e3000000-0000-4000-8000-00000000000${n}`;
      const period = `e4000000-0000-4000-8000-00000000000${n}`;
      await client.query(`insert into public.schools (id, slug, name, town, province, lowest_grade, highest_grade, is_verified, is_claimed)
        values ($1,$2,$3,'Test Town','Gauteng','G1','G7',true,true)`, [school, `test-school-${letter.toLowerCase()}`, `Test School ${letter}`]);
      await client.query(`insert into public.school_staff (school_id,user_id,role) values ($1,$2,'admin'),($1,$3,'staff')`, [school, users[`admin${letter}`], users[`teacher${letter}`]]);
      await client.query(`insert into public.staff_members (id,school_id,user_id,first_name,last_name,position,email)
        values ($1,$2,$3,'Test',$4,'Teacher',$5)`, [staff, school, users[`teacher${letter}`], `Teacher ${letter}`, accounts[`teacher${letter}`]]);
      await client.query(`insert into public.classes (id,school_id,academic_year,grade_code,name,class_teacher_id) values ($1,$2,$3,'G3','A',$4)`, [classroom, school, year, staff]);
      await client.query(`insert into public.subjects (school_id,grade_code,name,sort_order) values ($1,'G3','Mathematics',1),($1,'G3','English',2)`, [school]);
      await client.query(`insert into public.academic_terms (school_id,academic_year,term_number,opens_at,closes_at)
        select $1,$2,t,make_date($2,1,1),make_date($2,12,31) from generate_series(1,4) t`, [school, year]);
      await client.query(`insert into public.learners (id,school_id,current_class_id,first_name,last_name,date_of_birth,gender,admission_number,family_code)
        values ($1,$2,$3,'Lerato',$4,'2017-04-10','female',$5,$6)`, [learner, school, classroom, `Learner ${letter}`, `${letter}-001`, `FAMILY${letter}23`]);
      await client.query(`insert into public.learner_guardians (learner_id,user_id,full_name,relationship,phone,is_primary)
        values ($1,$2,$3,'Parent','0820000000',true)`, [learner, users[`parent${letter}`], `Test Parent ${letter}`]);
      await client.query(`insert into public.enrolment_periods (id,school_id,academic_year,name,status,opens_at,closes_at,fee_amount)
        values ($1,$2,$3,'Test intake','open','2020-01-01','2099-12-31',500)`, [period, school, year]);
      await client.query(`insert into public.period_grades (period_id,grade_code,is_open,capacity) values ($1,'G3',true,3),($1,'G4',true,0),($1,'G1',false,10)`, [period]);
      await client.query(`insert into public.school_bank_accounts (school_id,account_holder,bank_name,branch_code,account_number)
        values ($1,$2,'Fictional Bank - DO NOT PAY','000000','0000000000')`, [school, `Test School ${letter}`]);
    }
    await client.query(`insert into public.school_staff (school_id,user_id,role) values ('e0000000-0000-4000-8000-000000000001',$1,'staff')`, [users.unassignedA]);
    await client.query(`insert into public.staff_members (school_id,user_id,first_name,last_name,position) values ('e0000000-0000-4000-8000-000000000001',$1,'Unassigned','Teacher','Teacher')`, [users.unassignedA]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
  console.log('Seeded two fictional schools, eight accounts, classes, subjects, terms, learners and enrolment settings.');
}
