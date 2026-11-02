import { h } from '../lib/dom.js';
import { hasFilter, parseQuery, removeFilter, removeTerm, setFilter, toggleFilter } from '../lib/query.js';
import { SORTS, STATUS_LABELS, STATUS_ORDER, applyQuery, facetCounts } from '../lib/filter.js';
import { plural } from '../lib/format.js';
import { projectItem } from './project.js';

const TAG_LIMIT = 10;
const LANGUAGE_LIMIT = 8;

const SYNTAX = [
  ['status:released', 'released, in-progress, learning, paused or archived'],
  ['lang:swift', 'the main language, or one that is at least 10% of the code'],
  ['tag:ios', 'a tag or a GitHub topic'],
  ['area:apps', 'an area, a sub-area, or a path such as Apps/iPhone'],
  ['active:30d', 'active within 7d, 30d, 90d or 1y (also 2w, 6m)'],
  ['has:release', 'has a published release (or has:homepage)'],
  ['is:featured', 'featured; also is:stale (idle for 180 days) and is:archived'],
  ['license:mit', 'a license identifier'],
  ['-tag:template', 'a leading minus excludes'],
];

const present = (nodes) => nodes.filter((node) => node !== null && node !== undefined && node !== false);
const describe = (filter) => `${filter.negated ? 'not ' : ''}${filter.key}: ${filter.value}`;

// The search box, the filter panel and the result list. The query string in the box is the single source of truth.
export function initWork({ root, data, now, state, onChange }) {
  const { projects, groups } = data;
  const collapsed = new Set();
  const open = { tags: false, languages: false, panel: false };

  const input = h('input', {
    id: 'q', type: 'search', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', 'aria-describedby': 'syntax-help',
    placeholder: 'Search, or filter: status:released lang:swift',
  });
  input.value = state.q;
  const sortSelect = h('select', { id: 'sort' }, SORTS.map(([value, label]) => h('option', { value }, label)));
  const viewButtons = [['list', 'List'], ['grid', 'Grid']].map(([view, label]) => h('button', { type: 'button', 'data-view': view }, label));
  const countBadge = h('span', { class: 'filter-count', hidden: true });
  const panelButton = h('button', { type: 'button', class: 'filters-toggle', 'aria-expanded': 'false', 'aria-controls': 'facets' }, 'Filters ', countBadge);

  const toolbar = h('form', { class: 'toolbar', role: 'search', 'aria-label': 'Projects' },
    h('div', { class: 'search' }, h('label', { class: 'sr-only', for: 'q' }, 'Search projects'), input, h('kbd', { 'aria-hidden': 'true' }, '/')),
    h('label', { class: 'field' }, h('span', {}, 'Sort'), sortSelect),
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'View' }, viewButtons),
    panelButton);

  const syntax = h('details', { class: 'syntax', id: 'syntax-help' },
    h('summary', {}, 'Search syntax'),
    h('dl', {}, SYNTAX.flatMap(([code, text]) => [h('dt', {}, h('code', {}, code)), h('dd', {}, text)])),
    h('p', { class: 'muted' }, 'Words are searched in the name, summary, tags and languages. Qualifiers of one kind are combined with OR, different kinds with AND.'));
  const chips = h('ul', { class: 'chips', 'aria-label': 'Active filters' });
  const summary = h('p', { class: 'result-summary', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const facets = h('aside', { id: 'facets', class: 'facets', 'aria-label': 'Filters', hidden: true });
  const results = h('div', { class: 'results' });
  root.append(toolbar, syntax, chips, summary, h('div', { class: 'work-layout' }, facets, results));

  function setState(patch, { fromInput = false } = {}) {
    Object.assign(state, patch);
    if (!fromInput && input.value !== state.q) input.value = state.q;
    render();
    onChange(state);
  }

  // ---- chips and summary
  function renderChips(parsed) {
    const items = [
      ...parsed.filters.map((filter) => ({ label: describe(filter), remove: () => removeFilter(state.q, filter) })),
      ...parsed.terms.map((term, index) => ({ label: `${term.negated ? 'not ' : ''}“${term.value}”`, remove: () => removeTerm(state.q, index) })),
    ];
    chips.hidden = items.length === 0;
    chips.replaceChildren(...present([...items.map((item) => {
      const button = h('button', { type: 'button', class: 'chip', 'aria-label': `Remove filter ${item.label}` }, item.label, h('span', { 'aria-hidden': 'true' }, ' ×'));
      button.addEventListener('click', () => { setState({ q: item.remove() }); input.focus(); });
      return h('li', {}, button);
    }), items.length > 1 ? h('li', {}, h('button', { type: 'button', class: 'link-button', 'data-action': 'clear' }, 'Clear all')) : null]));
    countBadge.hidden = parsed.filters.length === 0;
    countBadge.textContent = String(parsed.filters.length);
  }

  // ---- filter panel
  function renderFacets(parsed) {
    const counts = facetCounts(projects, parsed, now, groups);
    const restore = facets.contains(document.activeElement) ? document.activeElement.dataset.focus : null;

    // "area:mac" and "area:Apps/Mac" mean the same area, so either spelling ticks the same box.
    const spelledAs = (key, value) => (key === 'area'
      ? parsed.filters.find((filter) => filter.key === 'area' && !filter.negated
        && [value, value.split('/').at(-1)].some((spelling) => spelling.toLowerCase() === filter.value.toLowerCase()))?.value
      : undefined);
    const box = (key, value, label, count, depth = 0) => {
      const existing = spelledAs(key, value);
      const checked = existing !== undefined || hasFilter(parsed, key, value);
      const id = `facet-${key}-${value}`.replace(/[^A-Za-z0-9_-]/g, '_');
      const item = h('li', { class: 'facet-item' }, h('label', { for: id },
        h('input', { type: 'checkbox', id, 'data-key': key, 'data-value': existing ?? value, 'data-focus': `${key}|${value}`, checked, disabled: count === 0 && !checked }),
        h('span', { class: 'facet-label' }, label), h('span', { class: 'count' }, String(count))));
      item.style.setProperty('--depth', depth);
      return item;
    };
    const group = (title, ...children) => h('fieldset', { class: 'facet' }, h('legend', {}, title), ...children);
    const limited = (entries, limit, flag, name, key) => {
      const selected = (entry) => hasFilter(parsed, key, entry.value);
      const visible = entries.filter((entry) => entry.count > 0 || selected(entry));
      const shown = open[flag] ? visible : visible.filter((entry, index) => index < limit || selected(entry));
      return [h('ul', {}, shown.map((entry) => box(key, entry.value, entry.label, entry.count))),
        visible.length > limit ? h('button', { type: 'button', class: 'link-button', 'data-action': 'more', 'data-flag': flag, 'data-focus': `more|${flag}` }, open[flag] ? 'Show fewer' : `Show all ${visible.length} ${name}`) : null];
    };

    const statusCount = (status) => counts.status.find((entry) => entry.value === status)?.count ?? 0;
    const presentStatuses = STATUS_ORDER.filter((status) => projects.some((project) => project.status === status));
    const activeNow = parsed.filters.find((filter) => filter.key === 'active' && !filter.negated)?.value ?? '';
    const radio = (value, label, count) => h('li', { class: 'facet-item' }, h('label', {},
      h('input', { type: 'radio', name: 'active', value, 'data-focus': `active|${value}`, checked: activeNow.toLowerCase() === value }),
      h('span', { class: 'facet-label' }, label), count === null ? null : h('span', { class: 'count' }, String(count))));

    facets.replaceChildren(...present([
      group('Area', h('ul', {}, counts.area.filter((area) => area.count > 0 || hasFilter(parsed, 'area', area.value)).map((area) => box('area', area.value, area.label, area.count, area.depth - 1)))),
      group('Status', h('ul', {}, presentStatuses.map((status) => box('status', status, STATUS_LABELS[status], statusCount(status))))),
      group('Last activity', h('ul', {}, radio('', 'Any time', null), counts.active.map((choice) => radio(choice.value, choice.label, choice.count)))),
      group('Language', ...limited(counts.lang, LANGUAGE_LIMIT, 'languages', 'languages', 'lang')),
      group('Tags', ...limited(counts.tag, TAG_LIMIT, 'tags', 'tags', 'tag')),
      group('More', h('ul', {}, box('has', 'release', 'Has a release', counts.release), box('is', 'featured', 'Featured', counts.featured))),
      counts.license.length > 1 ? group('License', h('ul', {}, counts.license.map((entry) => box('license', entry.value, entry.label, entry.count)))) : null,
      parsed.filters.length + parsed.terms.length > 0 ? h('button', { type: 'button', class: 'button', 'data-action': 'clear' }, 'Clear all filters') : null,
    ]));
    if (restore) facets.querySelector(`[data-focus="${CSS.escape(restore)}"]`)?.focus();
  }

  // ---- results
  const list = (items, showPath) => h('ul', { class: 'projects' }, items.map((project) => projectItem(project, { now, showPath })));

  function body(group, inside) {
    const direct = inside.filter((project) => project.group === group.path);
    const parts = direct.length > 0 ? [list(direct, false)] : [];
    for (const child of groups.filter((g) => g.depth === group.depth + 1 && g.path.startsWith(`${group.path}/`))) {
      const within = inside.filter((project) => project.group === child.path || project.group.startsWith(`${child.path}/`));
      if (within.length === 0) continue;
      parts.push(h('div', { class: 'subgroup', role: 'group', 'aria-label': child.title },
        h('p', { class: 'subgroup-title', 'aria-hidden': 'true' }, child.title, h('span', { class: 'count' }, String(within.length))), body(child, within)));
    }
    return h('div', { class: 'group-body' }, parts);
  }

  function renderResults(found) {
    if (found.length === 0) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'No projects match'),
        h('p', { class: 'muted' }, 'Remove a filter or search for fewer words.'),
        h('button', { type: 'button', class: 'button', 'data-action': 'clear' }, 'Clear all filters')));
      return;
    }
    if (state.sort !== 'area') {
      results.replaceChildren(list(found, true));
      return;
    }
    results.replaceChildren(...present(groups.filter((g) => g.depth === 1).map((top) => {
      const inside = found.filter((project) => project.group === top.path || project.group.startsWith(`${top.path}/`));
      if (inside.length === 0) return null;
      return h('details', { class: 'group', 'data-path': top.path, open: !collapsed.has(top.path) },
        h('summary', {}, h('span', { class: 'group-title' }, top.title), h('span', { class: 'count' }, plural(inside.length, 'project'))),
        body(top, inside));
    })));
  }

  function render() {
    const parsed = parseQuery(state.q);
    const found = applyQuery(projects, state.q, state.sort, groups, now);
    const narrowed = parsed.filters.length + parsed.terms.length > 0;
    summary.textContent = narrowed ? `${found.length} of ${plural(projects.length, 'project')} match` : plural(projects.length, 'project');
    sortSelect.value = state.sort;
    viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    results.className = `results view-${state.view}`;
    renderChips(parsed);
    renderFacets(parsed);
    renderResults(found);
  }

  // ---- events
  input.addEventListener('input', () => setState({ q: input.value }, { fromInput: true }));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value !== '') { event.preventDefault(); setState({ q: '' }); }
  });
  toolbar.addEventListener('submit', (event) => event.preventDefault());
  sortSelect.addEventListener('change', () => setState({ sort: sortSelect.value }));
  viewButtons.forEach((button) => button.addEventListener('click', () => setState({ view: button.dataset.view })));
  panelButton.addEventListener('click', () => {
    open.panel = !open.panel;
    facets.hidden = !open.panel;
    panelButton.setAttribute('aria-expanded', String(open.panel));
  });

  facets.addEventListener('change', (event) => {
    const target = event.target;
    if (target.type === 'checkbox') setState({ q: toggleFilter(state.q, target.dataset.key, target.dataset.value) });
    else if (target.type === 'radio') setState({ q: setFilter(state.q, 'active', target.value === '' ? null : target.value) });
  });
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'clear') setState({ q: '' });
    if (action.dataset.action === 'more') {
      open[action.dataset.flag] = !open[action.dataset.flag];
      renderFacets(parseQuery(state.q));
    }
  });
  results.addEventListener('click', (event) => {
    const tag = event.target.closest('button.tag');
    if (tag) { setState({ q: toggleFilter(state.q, 'tag', tag.dataset.tag) }); summary.focus(); }
  });
  results.addEventListener('toggle', (event) => {
    const details = event.target;
    if (details.matches?.('details.group')) {
      if (details.open) collapsed.delete(details.dataset.path); else collapsed.add(details.dataset.path);
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); input.focus(); input.select(); }
  });

  render();
  root.hidden = false;

  return {
    // Used by the featured cards: add or remove a filter, then bring the result list into view.
    toggleFilter(key, value) { setState({ q: toggleFilter(state.q, key, value) }); root.scrollIntoView({ block: 'start' }); summary.focus({ preventScroll: true }); },
  };
}
