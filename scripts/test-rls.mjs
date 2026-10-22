#!/usr/bin/env node
// Runs the cross-school isolation test (supabase/tests/tenant_isolation.sql) against the linked
// Supabase project and reports pass/fail. The SQL always rolls back; it signals the result by
// raising an exception whose message carries a sentinel.
//
//   npm run test:rls
//
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlFile = join(root, 'supabase', 'tests', 'tenant_isolation.sql');

const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', sqlFile], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

if (output.includes('SKOOLO_RLS_TESTS_PASSED')) {
  const m = output.match(/SKOOLO_RLS_TESTS_PASSED: ([^"\\]+)/);
  console.log(`\u2714 tenant isolation: ${m ? m[1].trim() : 'passed'}`);
  process.exit(0);
}

if (output.includes('SKOOLO_RLS_TESTS_FAILED')) {
  const m = output.match(/SKOOLO_RLS_TESTS_FAILED[^"\\]*/);
  console.error(`\u2718 tenant isolation FAILED`);
  console.error(m ? m[0].replace(/\\n|\\t/g, ' ').trim() : output);
  process.exit(1);
}

// Neither sentinel: the script errored before finishing (syntax, connection, etc.).
console.error('\u2718 tenant isolation test did not run to completion:');
console.error(output.trim().slice(0, 4000));
process.exit(1);
