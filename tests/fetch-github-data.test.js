import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHQL_QUERY, isAutomatedCommit } from '../scripts/fetch-github-data.js';

test('a commit by GitHub Actions is automated', () => {
  assert.equal(isAutomatedCommit({ author: { name: 'github-actions[bot]' } }), true);
});

test('a commit by another bot is automated', () => {
  assert.equal(isAutomatedCommit({ author: { name: 'dependabot[bot]' } }), true);
  assert.equal(isAutomatedCommit({ author: { name: 'google-labs-jules[bot]' } }), true);
});

test('a commit by a person is not automated', () => {
  assert.equal(isAutomatedCommit({ author: { name: 'Kosuke Satake' } }), false);
  assert.equal(isAutomatedCommit({ author: { name: 'kosuke' } }), false);
});

test('a name that only contains "bot" is not automated', () => {
  assert.equal(isAutomatedCommit({ author: { name: 'Abbott' } }), false);
  assert.equal(isAutomatedCommit({ author: { name: '[bot] fan' } }), false);
});

test('a commit without author data is kept', () => {
  assert.equal(isAutomatedCommit({}), false);
  assert.equal(isAutomatedCommit({ author: null }), false);
});

test('the query asks for the author name that the filter reads', () => {
  assert.match(GRAPHQL_QUERY, /author\s*\{\s*name\s*\}/);
});
