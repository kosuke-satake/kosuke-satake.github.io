// Numbers for the charts and the spec table, computed from the page data. Pure functions: no DOM.
import { STATUS_ORDER } from './filter.js';

const DAY = 86_400_000;
export const WEEKS = 52;
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const topArea = (project) => project.group.split('/')[0];
const inside = (project, path) => project.group === path || project.group.startsWith(`${path}/`);

// Which of the weekly bins a date falls in (0 is the oldest), or -1 when it is outside the window.
export function weekIndex(iso, reference, weeks = WEEKS) {
  const age = Math.floor((new Date(reference) - new Date(iso)) / (7 * DAY));
  return age >= 0 && age < weeks ? weeks - 1 - age : -1;
}

// 0 for none, then four steps for the cell colour of a week.
export function weekLevel(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 6) return 2;
  if (count <= 14) return 3;
  return 4;
}

// The index of each bin where a new month starts, with its name, for the axis of a chart.
export function monthTicks(weekStarts) {
  const ticks = [];
  let previous = null;
  weekStarts.forEach((start, index) => {
    const month = new Date(start).getUTCMonth();
    if (month !== previous) ticks.push({ index, label: MONTH_NAMES[month] });
    previous = month;
  });
  return ticks;
}

// Commits per week for each top-level area. Areas without any commit are left out.
export function effortByArea(projects, groups, weekStarts) {
  const areas = groups.filter((group) => group.depth === 1).map((group) => ({ path: group.path, title: group.title, total: 0 }));
  const weeks = weekStarts.map((start) => ({ start, counts: Object.fromEntries(areas.map((area) => [area.path, 0])), total: 0 }));
  for (const project of projects) {
    const area = areas.find((candidate) => candidate.path === topArea(project));
    if (!area) continue;
    weeks.forEach((week, index) => {
      const count = project.weekly[index] ?? 0;
      week.counts[area.path] += count;
      week.total += count;
      area.total += count;
    });
  }
  return { areas: areas.filter((area) => area.total > 0), weeks, max: Math.max(0, ...weeks.map((week) => week.total)) };
}

// Releases published in each of the last `months` calendar months (UTC), oldest first.
export function releasesByMonth(projects, reference, months = 12) {
  const end = new Date(reference);
  const buckets = Array.from({ length: months }, (_, index) => {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1 - index), 1));
    return { key: start.toISOString().slice(0, 7), label: MONTH_NAMES[start.getUTCMonth()], count: 0 };
  });
  for (const project of projects) {
    for (const release of project.releases.history) {
      const bucket = buckets.find((candidate) => candidate.key === release.publishedAt.slice(0, 7));
      if (bucket) bucket.count++;
    }
  }
  return buckets;
}

// Longest and current run of days with a contribution, and the busiest month, from the calendar weeks.
export function streaks(weeks) {
  const days = weeks.flat();
  let longest = 0;
  let longestEnd = null;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    if (run > longest) { longest = run; longestEnd = day.date; }
  }
  // Today may still be empty without breaking the current streak.
  let index = days.length - 1;
  if (index >= 0 && days[index].count === 0) index--;
  let current = 0;
  for (; index >= 0 && days[index].count > 0; index--) current++;

  const months = new Map();
  for (const day of days) months.set(day.date.slice(0, 7), (months.get(day.date.slice(0, 7)) ?? 0) + day.count);
  const [busiestMonth, busiestMonthCount] = [...months.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0] ?? [null, 0];
  return { longest, longestEnd, current, busiestMonth, busiestMonthCount, activeDays: days.filter((day) => day.count > 0).length };
}

// One row per area that has projects, and a total row first.
export function areaRows(projects, groups) {
  const summarize = (list) => {
    const bytes = new Map();
    for (const project of list) for (const language of project.languages) bytes.set(language.name, (bytes.get(language.name) ?? 0) + language.bytes);
    return {
      projects: list.length,
      released: list.filter((project) => project.status === 'released').length,
      releases: list.reduce((sum, project) => sum + project.releases.count, 0),
      commits: list.reduce((sum, project) => sum + project.commits.last52w, 0),
      languages: [...bytes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name),
      lastActive: list.reduce((latest, project) => (!latest || new Date(project.lastActive) > new Date(latest) ? project.lastActive : latest), null),
    };
  };
  const rows = groups
    .map((group) => ({ path: group.path, title: group.title, depth: group.depth, ...summarize(projects.filter((project) => inside(project, group.path))) }))
    .filter((row) => row.projects > 0);
  return [{ path: '', title: 'All work', depth: 0, ...summarize(projects) }, ...rows];
}

// The newest commits by a person across all projects, within the last `days` days, at most `perProject` from one
// project so that a busy project does not push out the others.
export function recentWork(projects, now, { days = 30, limit = 6, perProject = 2 } = {}) {
  const cutoff = new Date(now) - days * DAY;
  const taken = new Map();
  return projects
    .flatMap((project) => project.recent.map((commit) => ({ project, subject: commit.subject, date: commit.date, url: commit.url })))
    .filter((commit) => new Date(commit.date) >= cutoff)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter((commit) => {
      const count = taken.get(commit.project.name) ?? 0;
      taken.set(commit.project.name, count + 1);
      return count < perProject;
    })
    .slice(0, limit);
}

export function statusCounts(projects) {
  return STATUS_ORDER.map((status) => ({ status, count: projects.filter((project) => project.status === status).length })).filter((entry) => entry.count > 0);
}

// The most used tags (catalog tags and GitHub topics together), counted once per project.
export function tagCounts(projects, limit = 12) {
  const counts = new Map();
  for (const project of projects) {
    const own = new Map(); // the catalog's spelling wins over the GitHub topic's
    for (const value of [...project.tags, ...project.topics]) if (!own.has(value.toLowerCase())) own.set(value.toLowerCase(), value);
    for (const [key, tag] of own) counts.set(key, { tag: counts.get(key)?.tag ?? tag, count: (counts.get(key)?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, limit);
}
