import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig, assertDatabaseConfig } from '../src/config.js';

test('getConfig applies safe defaults', () => {
  const config = getConfig({ COGNODB_URI: 'bolt+s://db', COGNODB_PASSWORD: 'secret' });
  assert.equal(config.port, 3000);
  assert.equal(config.database.username, 'cognodb');
});

test('database config reports missing secrets without exposing values', () => {
  assert.throws(() => assertDatabaseConfig({ uri: '', username: 'cognodb', password: '' }), /COGNODB_URI, COGNODB_PASSWORD/);
});
