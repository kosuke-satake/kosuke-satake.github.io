import test from 'node:test';
import assert from 'node:assert/strict';
import { fatalErrors } from '../scripts/fetch-github-data.js';

test('a catalog repository that GitHub cannot find is not fatal', () => {
  const missing = { type: 'NOT_FOUND', path: ['p3'], message: "Could not resolve to a Repository with the name 'owner/gone'." };
  assert.deepEqual(fatalErrors([missing]), []);
});

test('any other error is fatal, including NOT_FOUND on the user', () => {
  const rateLimit = { type: 'RATE_LIMITED', path: ['p1'], message: 'API rate limit exceeded' };
  const noUser = { type: 'NOT_FOUND', path: ['user'], message: 'Could not resolve to a User' };
  const syntax = { message: 'Parse error on "}"' };
  assert.deepEqual(fatalErrors([rateLimit, noUser, syntax]), [rateLimit, noUser, syntax]);
});

test('no errors means nothing is fatal', () => {
  assert.deepEqual(fatalErrors(undefined), []);
  assert.deepEqual(fatalErrors([]), []);
});
