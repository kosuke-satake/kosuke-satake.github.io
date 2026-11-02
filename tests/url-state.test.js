import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, searchFromState, stateFromSearch } from '../js/lib/url-state.js';
import { formatDate, plural, relativeTime } from '../js/lib/format.js';

test('an empty address gives the default state', () => {
  assert.deepEqual(stateFromSearch(''), DEFAULT_STATE);
});

test('the state is read from the address', () => {
  assert.deepEqual(stateFromSearch('?q=status%3Areleased+lang%3Aswift&sort=name&view=grid'), { q: 'status:released lang:swift', sort: 'name', view: 'grid' });
});

test('unknown sort and view values fall back to the defaults', () => {
  assert.deepEqual(stateFromSearch('?sort=random&view=3d'), DEFAULT_STATE);
});

test('a very long query is cut', () => {
  assert.equal(stateFromSearch(`?q=${'a'.repeat(1000)}`).q.length, 300);
});

test('defaults are left out of the address', () => {
  assert.equal(searchFromState(DEFAULT_STATE), '');
  assert.equal(searchFromState({ q: '  ', sort: 'area', view: 'list' }), '');
});

test('a state survives a round trip through the address', () => {
  const state = { q: 'status:released -tag:template "menu bar"', sort: 'commits', view: 'grid' };
  assert.deepEqual(stateFromSearch(searchFromState(state)), state);
});

const NOW = new Date('2026-11-02T12:00:00Z');
const ago = (days, hours = 0) => new Date(NOW - days * 86_400_000 - hours * 3_600_000).toISOString();

test('relative times read naturally', () => {
  assert.equal(relativeTime(ago(0, 3), NOW), 'today');
  assert.equal(relativeTime(ago(1), NOW), 'yesterday');
  assert.equal(relativeTime(ago(12), NOW), '12 days ago');
  assert.equal(relativeTime(ago(45), NOW), '1 month ago');
  assert.equal(relativeTime(ago(200), NOW), '6 months ago');
  assert.equal(relativeTime(ago(400), NOW), '1 year ago');
  assert.equal(relativeTime(ago(800), NOW), '2 years ago');
});

test('plural and date formatting', () => {
  assert.equal(plural(1, 'release'), '1 release');
  assert.equal(plural(1234, 'commit'), '1,234 commits');
  assert.equal(formatDate('2026-10-25T19:26:11Z'), 'Oct 25, 2026');
});
