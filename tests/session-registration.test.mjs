import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../functions/api/session.js', import.meta.url), 'utf8');
const { onRequestPost, onRequestGet } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture() {
  const data = new Map();
  const env = {
    ADMIN_PASSWORD: 'test-only',
    GAME_SESSION_KV: {
      get: async (key, type) => data.has(key) ? (type === 'json' ? JSON.parse(data.get(key)) : data.get(key)) : null,
      put: async (key, value) => data.set(key, value),
      delete: async key => data.delete(key),
      list: async () => ({ keys: [], list_complete: true }),
    },
  };
  const post = async payload => {
    const response = await onRequestPost({ env, request: new Request('https://example.test/api/session', {
      method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' },
    }) });
    return { status: response.status, body: await response.json() };
  };
  const admin = payload => post({ adminPassword: 'test-only', ...payload });
  const get = async () => (await onRequestGet({ env, request: new Request('https://example.test/api/session') })).json();
  return { post, admin, get };
}

test('closing persists, blocks waiting/new players, preserves matches, and reopening allows entry', async () => {
  const f = fixture();
  await f.admin({ action: 'adminSave', hosted: true, selectedSubjectKey: 'math' });
  await f.post({ action: 'joinMatch', playerId: 'a' });
  const paired = (await f.post({ action: 'joinMatch', playerId: 'b' })).body;
  await f.post({ action: 'joinMatch', playerId: 'waiting' });
  const closed = (await f.admin({ action: 'setRegistrationClosed', closed: true })).body;
  assert.equal(closed.closingRound, true);
  assert.equal(closed.round, paired.round);
  assert.deepEqual(closed.matches, paired.matches);
  assert.deepEqual(closed.waitingPlayers, []);
  assert.equal((await f.post({ action: 'joinMatch', playerId: 'new' })).body.matchStatus, 'closed');
  assert.equal((await f.post({ action: 'joinMatch', playerId: 'waiting' })).body.matchStatus, 'closed');
  assert.notEqual((await f.post({ action: 'joinMatch', playerId: 'a' })).body.matchStatus, 'closed');
  assert.equal((await f.post({ action: 'joinMatch', playerId: 'b' })).body.matchStatus, 'matched');
  assert.equal((await f.get()).closingRound, true);
  const reopened = (await f.admin({ action: 'setRegistrationClosed', closed: false })).body;
  assert.equal(reopened.closingRound, false);
  assert.ok(reopened.matches[paired.match.id]);
  assert.equal(reopened.round, paired.round);
  assert.equal((await f.post({ action: 'joinMatch', playerId: 'new' })).body.matchStatus, 'waiting');
  assert.equal((await f.post({ action: 'joinMatch', playerId: 'waiting' })).body.matchStatus, 'matchedPending');
});

test('admission changes require an administrator, a boolean, and a hosted session', async () => {
  const f = fixture();
  assert.equal((await f.admin({ action: 'setRegistrationClosed', closed: true })).status, 409);
  await f.admin({ action: 'adminSave', hosted: true });
  assert.equal((await f.post({ action: 'setRegistrationClosed', closed: true })).status, 401);
  assert.equal((await f.admin({ action: 'setRegistrationClosed', closed: 'false' })).status, 400);
  assert.equal((await f.get()).closingRound, false);
});

test('repeated close requests and older clients do not advance rounds or clear matches', async () => {
  const f = fixture();
  await f.admin({ action: 'adminSave', hosted: true });
  await f.post({ action: 'joinMatch', playerId: 'a' });
  const paired = (await f.post({ action: 'joinMatch', playerId: 'b' })).body;
  await f.admin({ action: 'setRegistrationClosed', closed: true });
  const repeated = (await f.admin({ action: 'advanceRound' })).body;
  assert.equal(repeated.closingRound, true);
  assert.equal(repeated.round, paired.round);
  assert.deepEqual(repeated.matches, paired.matches);
});
