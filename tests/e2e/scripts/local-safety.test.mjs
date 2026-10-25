import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_URL, DB_URL, assertLocalApi, assertLocalDatabase, assertLocalProject } from './local-safety.mjs';
test('only the dedicated local API and database are accepted', () => {
  assert.doesNotThrow(() => assertLocalApi(API_URL));
  assert.doesNotThrow(() => assertLocalDatabase(DB_URL));
  for (const url of ['https://example.supabase.co', 'http://127.0.0.1:54321', API_URL + '.evil.test', API_URL + '/']) {
    assert.throws(() => assertLocalApi(url));
  }
  for (const url of ['postgresql://postgres:secret@db.example.com/postgres', DB_URL.replace('55322', '54322')]) {
    assert.throws(() => assertLocalDatabase(url));
  }
});
test('reset refuses any project other than the generated test project', () => {
  assert.doesNotThrow(() => assertLocalProject('project_id = "skoolo-e2e"\n[db]\nport = 55322'));
  assert.throws(() => assertLocalProject('project_id = "skoolo2"\n[db]\nport = 54322'));
});
