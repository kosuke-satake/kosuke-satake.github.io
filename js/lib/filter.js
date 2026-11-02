// Matching, facet counts and sorting for the project list. Pure functions: no DOM.
import { parseQuery } from './query.js';

const DAY = 86_400_000;

export const STATUS_ORDER = ['released', 'in-progress', 'learning', 'paused', 'archived'];
export const STATUS_LABELS = { released: 'Released', 'in-progress': 'In progress', learning: 'Learning', paused: 'Paused', archived: 'Archived' };
export const ACTIVE_CHOICES = [['7d', 'Past week'], ['30d', 'Past 30 days'], ['90d', 'Past 90 days'], ['1y', 'Past year']];
export const SORTS = [
  ['area', 'Area'],
  ['active', 'Recently active'],
  ['name', 'Name'],
  ['created', 'Newest first'],
  ['releases', 'Most releases'],
  ['commits', 'Most commits (52 weeks)'],
];
const STALE_DAYS = 180;
const LANGUAGE_SHARE = 0.1;

// "30d", "2w", "6m", "1y" -> days, or null when the value is not a window.
export function activeWindow(value) {
  const match = /^(\d+)([dwmy])$/i.exec(value);
  if (!match) return null;
  return Number(match[1]) * { d: 1, w: 7, m: 30, y: 365 }[match[2].toLowerCase()];
}

const ageInDays = (project, now) => (now - new Date(project.lastActive)) / DAY;

// Does one filter (key:value) hold for the project?
function holds(project, { key, value }, now) {
  const wanted = value.toLowerCase();
  switch (key) {
    case 'status':
      return project.status === wanted;
    case 'lang':
      return project.language?.name.toLowerCase() === wanted
        || project.languages.some((language) => language.name.toLowerCase() === wanted && language.share >= LANGUAGE_SHARE);
    case 'tag':
      return [...project.tags, ...project.topics].some((tag) => tag.toLowerCase() === wanted);
    case 'area': {
      const group = project.group.toLowerCase();
      return group === wanted || group.startsWith(`${wanted}/`) || group.split('/').includes(wanted);
    }
    case 'active': {
      const days = activeWindow(value);
      return days !== null && ageInDays(project, now) <= days;
    }
    case 'has':
      return (wanted === 'release' && project.releases.count > 0) || (wanted === 'homepage' && Boolean(project.homepage));
    case 'is':
      return (wanted === 'featured' && project.featured)
        || (wanted === 'archived' && (project.archived || project.status === 'archived'))
        || (wanted === 'stale' && ageInDays(project, now) > STALE_DAYS);
    case 'license':
      return (project.license ?? '').toLowerCase() === wanted;
    default:
      return false;
  }
}

// Different keys are combined with AND, values of the same key with OR, and a leading "-" excludes.
function passesFilters(project, filters, now, ignoreKey) {
  const keys = new Set(filters.map((filter) => filter.key));
  for (const key of keys) {
    if (key === ignoreKey) continue;
    const ofKey = filters.filter((filter) => filter.key === key);
    const wanted = ofKey.filter((filter) => !filter.negated);
    if (wanted.length > 0 && !wanted.some((filter) => holds(project, filter, now))) return false;
    if (ofKey.some((filter) => filter.negated && holds(project, filter, now))) return false;
  }
  return true;
}

function searchText(project) {
  return [
    project.name, project.id, project.summary, project.group, project.status,
    ...project.tags, ...project.topics, ...project.languages.map((language) => language.name),
  ].join(' ').toLowerCase();
}

function passesTerms(project, terms) {
  const text = searchText(project);
  return terms.every((term) => text.includes(term.value.toLowerCase()) !== term.negated);
}

export function filterProjects(projects, parsed, now) {
  return projects.filter((project) => passesTerms(project, parsed.terms) && passesFilters(project, parsed.filters, now));
}

const byCountThenName = (a, b) => b.count - a.count || a.label.localeCompare(b.label);

// Counts for the filter panel. Each facet is counted against the projects that match every OTHER filter, so a
// count always says how many results choosing that value would give.
export function facetCounts(projects, parsed, now, groups) {
  const within = (ignoreKey) => projects.filter((project) => passesTerms(project, parsed.terms) && passesFilters(project, parsed.filters, now, ignoreKey));
  const tally = (list, valuesOf, labelOf = (value) => value) => {
    const counts = new Map();
    for (const project of list) {
      const counted = new Set(); // a project counts once per value, whatever the letter case
      for (const value of valuesOf(project)) {
        const key = value.toLowerCase();
        if (counted.has(key)) continue;
        counted.add(key);
        counts.set(key, { value: counts.get(key)?.value ?? value, label: counts.get(key)?.label ?? labelOf(value), count: (counts.get(key)?.count ?? 0) + 1 });
      }
    }
    return [...counts.values()];
  };

  const status = tally(within('status'), (project) => [project.status], (value) => STATUS_LABELS[value] ?? value)
    .sort((a, b) => STATUS_ORDER.indexOf(a.value) - STATUS_ORDER.indexOf(b.value));
  const lang = tally(within('lang'), (project) => [
    ...(project.language ? [project.language.name] : []),
    ...project.languages.filter((language) => language.share >= LANGUAGE_SHARE).map((language) => language.name),
  ]).sort(byCountThenName);
  const tag = tally(within('tag'), (project) => [...project.tags, ...project.topics]).sort(byCountThenName);
  const license = tally(within('license'), (project) => (project.license ? [project.license] : [])).sort(byCountThenName);

  const areaCounts = new Map();
  for (const project of within('area')) {
    const parts = project.group.split('/');
    for (let depth = 1; depth <= parts.length; depth++) {
      const path = parts.slice(0, depth).join('/');
      areaCounts.set(path, (areaCounts.get(path) ?? 0) + 1);
    }
  }
  const area = groups.map((group) => ({ value: group.path, label: group.title, depth: group.depth, count: areaCounts.get(group.path) ?? 0 }));

  const activeBase = within('active');
  const active = ACTIVE_CHOICES.map(([value, label]) => ({
    value, label, count: activeBase.filter((project) => ageInDays(project, now) <= activeWindow(value)).length,
  }));

  return {
    status, lang, tag, license, area, active,
    release: within('has').filter((project) => project.releases.count > 0).length,
    featured: within('is').filter((project) => project.featured).length,
  };
}

export function sortProjects(projects, sort, groups) {
  const order = new Map(groups.map((group, index) => [group.path, index]));
  const byActive = (a, b) => new Date(b.lastActive) - new Date(a.lastActive) || a.name.localeCompare(b.name);
  const compare = {
    area: (a, b) => (order.get(a.group) ?? 0) - (order.get(b.group) ?? 0) || byActive(a, b),
    active: byActive,
    name: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
    created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || a.name.localeCompare(b.name),
    releases: (a, b) => b.releases.count - a.releases.count
      || new Date(b.releases.latest?.publishedAt ?? 0) - new Date(a.releases.latest?.publishedAt ?? 0)
      || a.name.localeCompare(b.name),
    commits: (a, b) => b.commits.last52w - a.commits.last52w || a.name.localeCompare(b.name),
  }[sort] ?? byActive;
  return [...projects].sort(compare);
}

export function applyQuery(projects, input, sort, groups, now) {
  const parsed = parseQuery(input);
  return sortProjects(filterProjects(projects, parsed, now), sort, groups);
}
