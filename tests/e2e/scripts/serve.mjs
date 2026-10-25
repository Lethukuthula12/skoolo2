import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertLocalApi, APP_URLS } from './local-safety.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(project, '../..');
let browser;
try { browser = JSON.parse(await readFile(path.join(project, '.local/browser.json'), 'utf8')); assertLocalApi(browser.apiUrl); }
catch { console.error('Run npm run local:setup first.'); process.exit(1); }
const ng = path.join(root, 'web/node_modules/@angular/cli/bin/ng.js');
const children = [];
let stopping = false;
const proxy = createServer((req, res) => {
  const host = req.headers.host?.split(':')[0];
  if (!['localhost', '127.0.0.1'].includes(host)) { res.writeHead(403); res.end('Local test hosts only'); return; }
  if (req.url === '/__skoolo_local') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ local: true, apiUrl: browser.apiUrl })); return; }
  const upstream = request({ hostname: '127.0.0.1', port: host === 'localhost' ? 4200 : 4300, path: req.url, method: req.method,
    headers: { ...req.headers, host: 'localhost' } }, response => {
    res.writeHead(response.statusCode || 502, response.headers); response.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(503); res.end('Angular is starting. Wait for both build messages and reload.'); });
  req.on('error', () => upstream.destroy()); req.pipe(upstream);
});
function stop(code = 0) {
  if (stopping) return; stopping = true;
  proxy.close();
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500).unref();
}
proxy.on('error', error => { console.error(error.message); stop(1); });
proxy.listen(4400, '127.0.0.1', () => {
  for (const [name, port] of [['parent-app', '4200'], ['school-portal', '4300']]) {
    const child = spawn(process.execPath, [ng, 'serve', name, '--configuration', 'local', '--host', '127.0.0.1', '--port', port, '--live-reload=false', '--hmr=false'],
      { cwd: path.join(root, 'web'), stdio: 'inherit', windowsHide: true });
    children.push(child);
    child.on('error', error => { console.error(error.message); stop(1); });
    child.on('exit', code => { if (!stopping) { console.error(`${name} stopped (${code}).`); stop(code || 1); } });
  }
  console.log(`Parent: ${APP_URLS.parent}\nPortal: ${APP_URLS.portal}\nKeep this terminal open. Ctrl+C stops both apps.`);
});
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
