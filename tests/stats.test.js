import test from 'node:test';
import assert from 'node:assert/strict';
import { areaRows, effortByArea, monthTicks, recentWork, releasesByMonth, statusCounts, streaks, tagCounts, weekIndex, weekLevel } from '../js/lib/stats.js';

const REFERENCE = '2026-11-02T12:00:00Z';
const ago = (days) => new Date(new Date(REFERENCE) - days * 86_400_000).toISOString();
const weekStarts = Array.from({ length: 52 }, (_, index) => ago((52 - index) * 7));

const groups = [
  { path: 'Apps', title: 'Apps', depth: 1 },
  { path: 'Apps/iPhone', title: 'iPhone', depth: 2 },
  { path: 'Robotics', title: 'Robotics', depth: 1 },
  { path: 'Empty', title: 'Empty', depth: 1 },
];

const weekly = (entries) => Object.assign(new Array(52).fill(0), entries);
const project = (name, overrides = {}) => ({
  name, group: 'Apps/iPhone', status: 'released', tags: [], topics: [],
  languages: [{ name: 'Swift', bytes: 900 }, { name: 'Shell', bytes: 100 }],
  commits: { last52w: 0 }, weekly: weekly({}), lastActive: ago(10),
  releases: { count: 0, history: [] }, ...overrides,
});

test('a date falls into the weekly bin that counts back from the reference', () => {
  assert.equal(weekIndex(ago(0), REFERENCE), 51);
  assert.equal(weekIndex(ago(6), REFERENCE), 51);
  assert.equal(weekIndex(ago(7), REFERENCE), 50);
  assert.equal(weekIndex(ago(363), REFERENCE), 0);
  assert.equal(weekIndex(ago(364), REFERENCE), -1);
  assert.equal(weekIndex(ago(-1), REFERENCE), -1);
});

test('week levels step at 1, 3, 7 and 15 commits', () => {
  assert.deepEqual([0, 1, 2, 3, 6, 7, 14, 15, 99].map(weekLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('month ticks mark the first bin of each month', () => {
  const ticks = monthTicks(['2026-10-26T00:00:00Z', '2026-11-02T00:00:00Z', '2026-11-09T00:00:00Z', '2026-12-07T00:00:00Z']);
  assert.deepEqual(ticks, [{ index: 0, label: 'Oct' }, { index: 1, label: 'Nov' }, { index: 3, label: 'Dec' }]);
});

test('effort is summed per top-level area and week, and idle areas are left out', () => {
  const projects = [
    project('a', { weekly: weekly({ 51: 4, 50: 1 }) }),
    project('b', { group: 'Apps', weekly: weekly({ 51: 2 }) }),
    project('c', { group: 'Robotics', weekly: weekly({ 50: 3 }) }),
  ];
  const effort = effortByArea(projects, groups, weekStarts);
  assert.deepEqual(effort.areas.map((area) => [area.path, area.total]), [['Apps', 7], ['Robotics', 3]]);
  assert.deepEqual(effort.weeks[51].counts, { Apps: 6, Robotics: 0, Empty: 0 });
  assert.equal(effort.weeks[50].total, 4);
  assert.equal(effort.max, 6);
});

test('releases are counted per calendar month, for the last twelve months', () => {
  const projects = [
    project('a', { releases: { count: 3, history: [{ publishedAt: '2026-10-25T10:00:00Z' }, { publishedAt: '2026-10-02T10:00:00Z' }, { publishedAt: '2026-04-05T10:00:00Z' }] } }),
    project('b', { releases: { count: 2, history: [{ publishedAt: '2026-11-01T10:00:00Z' }, { publishedAt: '2025-10-30T10:00:00Z' }] } }),
  ];
  const months = releasesByMonth(projects, REFERENCE);
  assert.equal(months.length, 12);
  assert.deepEqual([months[0].key, months[11].key], ['2025-12', '2026-11']);
  assert.deepEqual(months.filter((month) => month.count > 0).map((month) => [month.key, month.count]), [['2026-04', 1], ['2026-10', 2], ['2026-11', 1]]);
  assert.equal(months[11].label, 'Nov');
});

test('streaks find the longest run, the current run and the busiest month', () => {
  // Nine consecutive days from 26 October: 1, 2, 0, 1, 1, 1, 0, 5, 0.
  const counts = [1, 2, 0, 1, 1, 1, 0, 5, 0];
  const days = counts.map((count, index) => ({ date: new Date(Date.UTC(2026, 9, 26 + index)).toISOString().slice(0, 10), count }));
  const result = streaks([days.slice(0, 7), days.slice(7)]);
  assert.equal(result.longest, 3);
  assert.equal(result.longestEnd, '2026-10-31');
  assert.equal(result.current, 1);
  assert.equal(result.busiestMonth, '2026-10');
  assert.equal(result.busiestMonthCount, 6);
  assert.equal(result.activeDays, 6);
});

test('a calendar with no contribution has no streak', () => {
  const result = streaks([[{ date: '2026-11-01', count: 0 }]]);
  assert.deepEqual([result.longest, result.current, result.activeDays], [0, 0, 0]);
});

test('the area table has a total row and a row per area that has projects', () => {
  const projects = [
    project('a', { releases: { count: 6, history: [] }, commits: { last52w: 66 }, lastActive: ago(5) }),
    project('b', { group: 'Robotics', status: 'learning', languages: [{ name: 'Python', bytes: 50 }], commits: { last52w: 8 }, lastActive: ago(30) }),
  ];
  const rows = areaRows(projects, groups);
  assert.deepEqual(rows.map((row) => row.title), ['All work', 'Apps', 'iPhone', 'Robotics']);
  assert.deepEqual([rows[0].projects, rows[0].released, rows[0].releases, rows[0].commits], [2, 1, 6, 74]);
  assert.deepEqual(rows[1].languages, ['Swift', 'Shell']);
  assert.deepEqual(rows[3].languages, ['Python']);
  assert.equal(rows[0].lastActive, ago(5));
});

test('recent work is the newest commits across projects, within the window, up to the limit', () => {
  const commit = (subject, days) => ({ subject, date: ago(days), url: `u-${subject}` });
  const projects = [
    project('a', { recent: [commit('a1', 2), commit('a2', 20), commit('a3', 45)] }),
    project('b', { recent: [commit('b1', 1), commit('b2', 29)] }),
    project('c', { recent: [] }),
  ];
  assert.deepEqual(recentWork(projects, REFERENCE).map((entry) => entry.subject), ['b1', 'a1', 'a2', 'b2']);
  const busy = [project('x', { recent: [commit('x1', 1), commit('x2', 2), commit('x3', 3)] }), project('y', { recent: [commit('y1', 5)] })];
  assert.deepEqual(recentWork(busy, REFERENCE).map((entry) => entry.subject), ['x1', 'x2', 'y1']);
  assert.deepEqual(recentWork(busy, REFERENCE, { perProject: 3 }).map((entry) => entry.subject), ['x1', 'x2', 'x3', 'y1']);
  assert.deepEqual(recentWork(projects, REFERENCE, { limit: 2 }).map((entry) => entry.subject), ['b1', 'a1']);
  assert.deepEqual(recentWork(projects, REFERENCE, { days: 3 }).map((entry) => entry.subject), ['b1', 'a1']);
  assert.equal(recentWork(projects, REFERENCE)[0].project.name, 'b');
  assert.deepEqual(recentWork([], REFERENCE), []);
});

test('statuses follow the fixed order and skip empty ones', () => {
  const projects = [project('a', { status: 'learning' }), project('b'), project('c', { status: 'learning' })];
  assert.deepEqual(statusCounts(projects), [{ status: 'released', count: 1 }, { status: 'learning', count: 2 }]);
});

test('tags and topics are counted once per project, case-insensitively', () => {
  const projects = [
    project('a', { tags: ['ios', 'swift'], topics: ['iOS'] }),
    project('b', { tags: ['swift'], topics: [] }),
    project('c', { tags: ['audio'], topics: [] }),
  ];
  assert.deepEqual(tagCounts(projects, 2), [{ tag: 'swift', count: 2 }, { tag: 'audio', count: 1 }]);
  assert.deepEqual(tagCounts(projects).find((entry) => entry.tag.toLowerCase() === 'ios'), { tag: 'ios', count: 1 });
});
