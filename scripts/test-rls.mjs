#!/usr/bin/env node
// Runs the database separation tests against the linked Supabase project and reports pass/fail.
// Each test is a .sql file that always rolls back and signals its result by raising an exception
// whose message carries a sentinel. All of them must pass.
//
//   npm run test:rls
//
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  ['tenant isolation', 'supabase/tests/tenant_isolation.sql'],
  ['coverage guard', 'supabase/tests/rls_coverage.sql'],
];

let failed = false;
for (const [name, rel] of tests) {
  const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', join(root, rel)], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (output.includes('SKOOLO_RLS_TESTS_PASSED')) {
    const m = output.match(/SKOOLO_RLS_TESTS_PASSED: ([^"\\]+)/);
    console.log(`\u2714 ${name}: ${m ? m[1].trim() : 'passed'}`);
  } else if (output.includes('SKOOLO_RLS_TESTS_FAILED')) {
    const m = output.match(/SKOOLO_RLS_TESTS_FAILED[^"\\]*/);
    console.error(`\u2718 ${name} FAILED`);
    console.error(`  ${(m ? m[0] : output).replace(/\\n|\\t/g, ' ').trim()}`);
    failed = true;
  } else {
    console.error(`\u2718 ${name} did not run to completion:`);
    console.error(output.trim().slice(0, 3000));
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
