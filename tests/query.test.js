import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFilter, parseQuery, removeFilter, removeTerm, serializeQuery, setFilter, toggleFilter } from '../js/lib/query.js';

test('free words and qualifiers are separated', () => {
  const parsed = parseQuery('bus status:released lang:Swift map');
  assert.deepEqual(parsed.terms, [{ value: 'bus', negated: false }, { value: 'map', negated: false }]);
  assert.deepEqual(parsed.filters, [
    { key: 'status', value: 'released', negated: false },
    { key: 'lang', value: 'Swift', negated: false },
  ]);
});

test('a leading minus excludes, for qualifiers and for words', () => {
  const parsed = parseQuery('-tag:template -draft');
  assert.deepEqual(parsed.filters, [{ key: 'tag', value: 'template', negated: true }]);
  assert.deepEqual(parsed.terms, [{ value: 'draft', negated: true }]);
});

test('quoted phrases stay together, also after a qualifier', () => {
  const parsed = parseQuery('"menu bar" tag:"apple silicon"');
  assert.deepEqual(parsed.terms, [{ value: 'menu bar', negated: false }]);
  assert.deepEqual(parsed.filters, [{ key: 'tag', value: 'apple silicon', negated: false }]);
});

test('an unknown qualifier is searched as plain text', () => {
  assert.deepEqual(parseQuery('http://example.com').terms, [{ value: 'http://example.com', negated: false }]);
  assert.deepEqual(parseQuery('color:red').terms, [{ value: 'color:red', negated: false }]);
});

test('empty and blank input give nothing', () => {
  assert.deepEqual(parseQuery(''), { terms: [], filters: [] });
  assert.deepEqual(parseQuery('   '), { terms: [], filters: [] });
  assert.deepEqual(parseQuery(undefined), { terms: [], filters: [] });
  assert.deepEqual(parseQuery('status:'), { terms: [], filters: [] });
});

test('serializing puts filters first, quotes phrases and keeps the exclusion sign', () => {
  const text = 'bus "menu bar" tag:ios -status:learning';
  assert.equal(serializeQuery(parseQuery(text)), 'tag:ios -status:learning bus "menu bar"');
});

test('parsing the serialized text gives the same query', () => {
  const parsed = parseQuery('a -b status:released -lang:python tag:"two words"');
  assert.deepEqual(parseQuery(serializeQuery(parsed)), parsed);
});

test('toggling adds a filter, and removes it when it is there already', () => {
  const added = toggleFilter('bus', 'status', 'released');
  assert.equal(added, 'status:released bus');
  assert.equal(toggleFilter(added, 'status', 'RELEASED'), 'bus');
});

test('toggling the opposite sign replaces the filter instead of stacking both', () => {
  assert.equal(toggleFilter('tag:ios', 'tag', 'ios', true), '-tag:ios');
  assert.equal(toggleFilter('-tag:ios', 'tag', 'ios', false), 'tag:ios');
});

test('setFilter keeps one value per key and clears with null', () => {
  assert.equal(setFilter('active:7d bus', 'active', '30d'), 'active:30d bus');
  assert.equal(setFilter('active:7d bus', 'active', null), 'bus');
  assert.equal(setFilter('bus', 'active', '90d'), 'active:90d bus');
});

test('single filters and words can be removed', () => {
  assert.equal(removeFilter('status:released lang:swift', { key: 'status', value: 'released', negated: false }), 'lang:swift');
  assert.equal(removeTerm('status:released one two', 1), 'status:released one');
});

test('hasFilter ignores case and respects the sign', () => {
  const parsed = parseQuery('lang:Swift -tag:template');
  assert.equal(hasFilter(parsed, 'lang', 'swift'), true);
  assert.equal(hasFilter(parsed, 'tag', 'template'), false);
  assert.equal(hasFilter(parsed, 'tag', 'template', true), true);
});
