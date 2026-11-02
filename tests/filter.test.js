import test from 'node:test';
import assert from 'node:assert/strict';
import { activeWindow, applyQuery, facetCounts, filterProjects, sortProjects } from '../js/lib/filter.js';
import { parseQuery } from '../js/lib/query.js';

const NOW = new Date('2026-11-02T12:00:00Z');
const ago = (days) => new Date(NOW - days * 86_400_000).toISOString();

const groups = [
  { path: 'Apps', title: 'Apps', depth: 1 },
  { path: 'Apps/iPhone', title: 'iPhone', depth: 2 },
  { path: 'Apps/Mac', title: 'Mac', depth: 2 },
  { path: 'Web', title: 'Web', depth: 1 },
];

const project = (name, overrides = {}) => ({
  id: `owner/${name}`, name, summary: `${name} summary`, group: 'Apps/iPhone', status: 'released', featured: false,
  tags: [], topics: [], language: { name: 'Swift', color: '#F05138' },
  languages: [{ name: 'Swift', share: 0.9 }, { name: 'Shell', share: 0.05 }],
  license: 'MIT', archived: false, homepage: null, createdAt: ago(300), lastActive: ago(10),
  commits: { last52w: 10 }, releases: { count: 1, latest: { publishedAt: ago(20) } },
  ...overrides,
});

const projects = [
  project('Headway', { tags: ['maps', 'transit'], topics: ['ios'], featured: true, lastActive: ago(5), commits: { last52w: 66 }, releases: { count: 6, latest: { publishedAt: ago(8) } }, summary: 'Offline bus map' }),
  project('Mantissa', { tags: ['calculator'], lastActive: ago(6), commits: { last52w: 51 }, releases: { count: 4, latest: { publishedAt: ago(7) } } }),
  project('Tapdeck', { group: 'Apps/Mac', tags: ['audio'], topics: ['macos'], lastActive: ago(9), commits: { last52w: 123 }, releases: { count: 2, latest: { publishedAt: ago(9) } } }),
  project('rover', { group: 'Web', status: 'in-progress', language: { name: 'C++' }, languages: [{ name: 'C++', share: 1 }], license: 'Apache-2.0', lastActive: ago(40), releases: { count: 0, latest: null }, commits: { last52w: 34 } }),
  project('old-notes', { group: 'Web', status: 'learning', language: { name: 'Python' }, languages: [{ name: 'Python', share: 0.8 }, { name: 'Shell', share: 0.2 }], license: null, lastActive: ago(400), createdAt: ago(500), releases: { count: 0, latest: null }, commits: { last52w: 0 } }),
];

const names = (list) => list.map((item) => item.name);
const run = (query) => names(filterProjects(projects, parseQuery(query), NOW));

test('no query keeps every project', () => {
  assert.deepEqual(run(''), ['Headway', 'Mantissa', 'Tapdeck', 'rover', 'old-notes']);
});

test('free words search the name, summary, tags, topics and languages', () => {
  assert.deepEqual(run('bus'), ['Headway']);
  assert.deepEqual(run('transit'), ['Headway']);
  assert.deepEqual(run('macos'), ['Tapdeck']);
  assert.deepEqual(run('c++'), ['rover']);
  assert.deepEqual(run('mantissa summary'), ['Mantissa']);
});

test('every free word must match, and a minus excludes', () => {
  assert.deepEqual(run('swift maps'), ['Headway']);
  assert.deepEqual(run('swift -maps'), ['Mantissa', 'Tapdeck']);
});

test('status, language and license qualifiers', () => {
  assert.deepEqual(run('status:learning'), ['old-notes']);
  assert.deepEqual(run('lang:python'), ['old-notes']);
  assert.deepEqual(run('license:apache-2.0'), ['rover']);
});

test('a language counts when it is at least 10 percent of the code', () => {
  assert.deepEqual(run('lang:shell'), ['old-notes']);
});

test('tag matches both catalog tags and GitHub topics', () => {
  assert.deepEqual(run('tag:ios'), ['Headway']);
  assert.deepEqual(run('tag:audio'), ['Tapdeck']);
});

test('area matches a full path, a parent, or one segment', () => {
  assert.deepEqual(run('area:apps'), ['Headway', 'Mantissa', 'Tapdeck']);
  assert.deepEqual(run('area:Apps/iPhone'), ['Headway', 'Mantissa']);
  assert.deepEqual(run('area:mac'), ['Tapdeck']);
});

test('values of one key are OR, different keys are AND', () => {
  assert.deepEqual(run('status:released status:learning'), ['Headway', 'Mantissa', 'Tapdeck', 'old-notes']);
  assert.deepEqual(run('status:released status:learning area:web'), ['old-notes']);
});

test('a negated qualifier removes matches', () => {
  assert.deepEqual(run('area:apps -tag:maps'), ['Mantissa', 'Tapdeck']);
  assert.deepEqual(run('-status:released'), ['rover', 'old-notes']);
});

test('active windows compare the last activity with now', () => {
  assert.deepEqual(run('active:7d'), ['Headway', 'Mantissa']);
  assert.deepEqual(run('active:30d'), ['Headway', 'Mantissa', 'Tapdeck']);
  assert.deepEqual(run('active:1y'), ['Headway', 'Mantissa', 'Tapdeck', 'rover']);
  assert.deepEqual(run('active:nonsense'), []);
});

test('has and is qualifiers', () => {
  assert.deepEqual(run('has:release'), ['Headway', 'Mantissa', 'Tapdeck']);
  assert.deepEqual(run('is:featured'), ['Headway']);
  assert.deepEqual(run('is:stale'), ['old-notes']);
  assert.deepEqual(run('has:homepage'), []);
});

test('activeWindow understands days, weeks, months and years', () => {
  assert.equal(activeWindow('30d'), 30);
  assert.equal(activeWindow('2w'), 14);
  assert.equal(activeWindow('6m'), 180);
  assert.equal(activeWindow('1y'), 365);
  assert.equal(activeWindow('soon'), null);
});

test('facet counts ignore the facet itself, so a count says what choosing it would give', () => {
  const counts = facetCounts(projects, parseQuery('status:released'), NOW, groups);
  assert.deepEqual(counts.status.map((s) => [s.value, s.count]), [['released', 3], ['in-progress', 1], ['learning', 1]]);
  // Shell is under 10 percent of the code of every released project, so only Swift is offered.
  assert.deepEqual(counts.lang.map((l) => [l.value, l.count]), [['Swift', 3]]);
});

test('a language facet offers values that the other filters would still allow', () => {
  const counts = facetCounts(projects, parseQuery('lang:python'), NOW, groups);
  assert.deepEqual(counts.lang.map((l) => [l.value, l.count]), [['Swift', 3], ['C++', 1], ['Python', 1], ['Shell', 1]]);
});

test('facet counts follow the other filters', () => {
  const counts = facetCounts(projects, parseQuery('area:apps'), NOW, groups);
  assert.deepEqual(counts.status.map((s) => [s.value, s.count]), [['released', 3]]);
  assert.equal(counts.release, 3);
  assert.equal(counts.featured, 1);
});

test('areas are counted with their parents and keep the catalog order', () => {
  const counts = facetCounts(projects, parseQuery(''), NOW, groups);
  assert.deepEqual(counts.area.map((a) => [a.value, a.count]), [['Apps', 3], ['Apps/iPhone', 2], ['Apps/Mac', 1], ['Web', 2]]);
});

test('the activity facet counts projects inside each window', () => {
  const counts = facetCounts(projects, parseQuery(''), NOW, groups);
  assert.deepEqual(counts.active.map((a) => [a.value, a.count]), [['7d', 2], ['30d', 3], ['90d', 4], ['1y', 4]]);
});

test('tags and topics are counted once per project', () => {
  const duplicated = [project('x', { tags: ['ios'], topics: ['IOS'] })];
  assert.deepEqual(facetCounts(duplicated, parseQuery(''), NOW, groups).tag.map((t) => t.count), [1]);
});

test('sorting by area follows the catalog, then the latest activity', () => {
  assert.deepEqual(names(sortProjects(projects, 'area', groups)), ['Headway', 'Mantissa', 'Tapdeck', 'rover', 'old-notes']);
});

test('sorting by activity, name, newest, releases and commits', () => {
  assert.deepEqual(names(sortProjects(projects, 'active', groups)), ['Headway', 'Mantissa', 'Tapdeck', 'rover', 'old-notes']);
  assert.deepEqual(names(sortProjects(projects, 'name', groups)), ['Headway', 'Mantissa', 'old-notes', 'rover', 'Tapdeck']);
  assert.deepEqual(names(sortProjects(projects, 'created', groups)).at(-1), 'old-notes');
  assert.deepEqual(names(sortProjects(projects, 'releases', groups)).slice(0, 3), ['Headway', 'Mantissa', 'Tapdeck']);
  assert.deepEqual(names(sortProjects(projects, 'commits', groups)).slice(0, 2), ['Tapdeck', 'Headway']);
});

test('sorting does not change the original list', () => {
  const before = names(projects);
  sortProjects(projects, 'name', groups);
  assert.deepEqual(names(projects), before);
});

test('applyQuery filters and then sorts', () => {
  assert.deepEqual(names(applyQuery(projects, 'area:apps', 'name', groups, NOW)), ['Headway', 'Mantissa', 'Tapdeck']);
});
