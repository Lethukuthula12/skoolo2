export const API_URL = 'http://127.0.0.1:55321';
export const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
export const APP_URLS = Object.freeze({ parent: 'http://localhost:4400', portal: 'http://127.0.0.1:4400' });
export const LOCAL_PROJECT = 'skoolo-e2e';
export function assertLocalApi(value) {
  if (value !== API_URL) throw new Error('Refusing non-test API. Expected ' + API_URL);
}
export function assertLocalDatabase(value) {
  if (value !== DB_URL) throw new Error('Refusing non-test database. Only the dedicated local test database is allowed.');
}
export function assertLocalProject(config) {
  if (!/^project_id = "skoolo-e2e"$/m.test(config) || !/^port = 55322$/m.test(config)) {
    throw new Error('Refusing to operate on an unrecognised Supabase project.');
  }
}
