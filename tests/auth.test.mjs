import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestGet, onRequestPost } from '../functions/api/auth.js';

const env = { PASSWORD: 'student-secret', ADMIN_PASSWORD: 'admin-secret' };
const post = (body) => onRequestPost({ env, request: new Request('https://example.test/api/auth', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}) });

test('password gate starts hidden and is only opened after the saved-access check', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="passwordGate"[^>]*\shidden(?:\s|>)/);
  assert.match(main, /if \(!authState\.startupUnlocked\) \{\s*authState\.startupUnlocked = await showPasswordGate\("startup"\);/);
  assert.match(html, /id="rememberedStartButton"[^>]*\shidden(?:\s|>)/);
  assert.match(main, /if \(usedSavedAccess\) \{\s*await waitForRememberedStart\(\);/);
});

test('startup authentication issues a hardened cookie accepted by GET', async () => {
  const response = await post({ mode: 'startup', password: env.PASSWORD });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /^__Host-study_quiz_access=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const status = await onRequestGet({ env, request: new Request('https://example.test/api/auth', { headers: { Cookie: cookie.split(';', 1)[0] } }) });
  assert.deepEqual(await status.json(), { ok: true, authenticated: true });
});

test('tampered and password-rotation cookies are rejected', async () => {
  const response = await post({ mode: 'startup', password: env.PASSWORD });
  const pair = response.headers.get('set-cookie').split(';', 1)[0];
  const tampered = `${pair.slice(0, -1)}${pair.endsWith('a') ? 'b' : 'a'}`;
  for (const [cookie, testEnv] of [[tampered, env], [pair, { ...env, PASSWORD: 'rotated' }]]) {
    const status = await onRequestGet({ env: testEnv, request: new Request('https://example.test/api/auth', { headers: { Cookie: cookie } }) });
    assert.deepEqual(await status.json(), { ok: true, authenticated: false });
  }
});

test('admin authentication never creates a persistent cookie', async () => {
  const response = await post({ mode: 'admin', password: env.ADMIN_PASSWORD });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('invalid passwords do not authenticate or leak diagnostics', async () => {
  const response = await post({ mode: 'startup', password: 'wrong', debug: true });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: 'INVALID_PASSWORD' });
  assert.equal(response.headers.get('set-cookie'), null);
});
