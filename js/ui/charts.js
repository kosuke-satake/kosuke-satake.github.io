import { externalLink, h } from '../lib/dom.js';
import { STATUS_LABELS } from '../lib/filter.js';
import { formatCount, formatDate, plural, relativeTime } from '../lib/format.js';
import { areaRows, effortByArea, monthTicks, releasesByMonth, statusCounts, tagCounts, topArea, weekIndex, weekLevel } from '../lib/stats.js';

// A round axis maximum that is not smaller than the data.
function niceMax(max) {
  const steps = [4, 8, 10, 20, 40, 60, 80, 100, 150, 200, 300, 400, 600, 800, 1000];
  return steps.find((step) => step >= max) ?? Math.ceil(max / 100) * 100;
}

const card = (title, note, ...children) => h('div', { class: 'card' }, h('h3', {}, title), note ? h('p', { class: 'card-note' }, note) : null, ...children);
const swatch = (index) => h('span', { class: `swatch bg-area-${index}`, 'aria-hidden': 'true' });

// ---- Timeline: one row per project, one column per week, a diamond for each release
export function timelineCard(data) {
  const reference = data.generatedAt;
  const ticks = monthTicks(data.weekStarts);
  const scroll = h('div', { class: 'swim-scroll', tabindex: '0', role: 'region', 'aria-label': 'Project timeline, scrolls sideways' });
  const swim = h('div', { class: 'swim' });

  const months = h('div', { class: 'swim-row swim-head', 'aria-hidden': 'true' }, h('span', { class: 'swim-name' }),
    ticks.map((tick) => { const label = h('span', {}, tick.label); label.style.gridColumnStart = tick.index + 2; return label; }));
  swim.append(months);

  const summaries = [];
  for (const group of data.groups.filter((candidate) => candidate.depth === 1)) {
    const projects = data.projects.filter((project) => topArea(project) === group.path)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (projects.length === 0) continue;
    swim.append(h('div', { class: 'swim-area', 'aria-hidden': 'true' }, group.title));
    for (const project of projects) {
      const cells = data.weekStarts.map((start, index) => {
        const count = project.weekly[index] ?? 0;
        return h('span', { class: `swim-cell level-${weekLevel(count)}`, title: count ? `${plural(count, 'commit')}, week of ${formatDate(start)}` : null });
      });
      const released = new Map();
      for (const release of project.releases.history) {
        const index = weekIndex(release.publishedAt, reference);
        if (index >= 0) released.set(index, [...(released.get(index) ?? []), `${release.tag} (${formatDate(release.publishedAt)})`]);
      }
      for (const [index, releases] of released) {
        cells[index].append(h('i', { class: 'rel' }));
        cells[index].title = [cells[index].title, `Released ${releases.join(', ')}`].filter(Boolean).join('; ');
      }
      swim.append(h('div', { class: 'swim-row' }, externalLink(project.url, project.name, { class: 'swim-name', title: project.name }), h('span', { class: 'swim-cells', 'aria-hidden': 'true' }, cells)));
      const activeWeeks = project.weekly.filter((count) => count > 0).length;
      const recentReleases = project.releases.history.filter((release) => weekIndex(release.publishedAt, reference) >= 0).length;
      summaries.push(h('li', {}, `${project.name}: active in ${plural(activeWeeks, 'week')} of the last 52, ${plural(recentReleases, 'release')} in that time.`));
    }
  }
  scroll.append(swim);
  requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });

  const legend = h('div', { class: 'cal-legend', 'aria-hidden': 'true' },
    h('span', {}, 'Fewer commits'), [0, 1, 2, 3, 4].map((level) => h('span', { class: `cal-day level-${level}` })), h('span', {}, 'More'),
    h('span', { class: 'legend-gap' }, h('i', { class: 'rel inline' }), ' Release'));
  return h('div', { class: 'card span-2' }, h('h3', {}, 'Timeline'),
    h('p', { class: 'card-note' }, 'Each row is a project and each column a week, oldest on the left. Darker cells are weeks with more commits.'),
    scroll, legend, h('ul', { class: 'sr-only' }, summaries));
}

// ---- Commits per week by area, stacked. Plain HTML and CSS, so the axis text keeps its size on a narrow screen.
export function effortCard(data) {
  const { areas, weeks, max } = effortByArea(data.projects, data.groups, data.weekStarts);
  if (areas.length === 0) return card('Where the effort went', null, h('p', { class: 'muted' }, 'No commits in the last 52 weeks.'));

  const ceiling = niceMax(max);
  const columns = weeks.map((week) => {
    const parts = areas.filter((area) => week.counts[area.path] > 0).map((area) => `${area.title} ${week.counts[area.path]}`);
    return h('div', { class: 'col', title: `Week of ${formatDate(week.start)}: ${parts.join(', ') || 'no commits'}` },
      areas.map((area, index) => {
        const count = week.counts[area.path];
        if (!count) return null;
        const segment = h('span', { class: `bg-area-${index}` });
        segment.style.height = `${(count / ceiling) * 100}%`;
        return segment;
      }));
  });
  const monthMarks = monthTicks(data.weekStarts).map((tick) => { const mark = h('span', {}, tick.label); mark.style.left = `${(tick.index / weeks.length) * 100}%`; return mark; });

  const chart = h('div', {
    class: 'bars', role: 'img',
    'aria-label': `Commits per week over the last 52 weeks, by area: ${areas.map((area) => `${area.title} ${area.total}`).join(', ')}.`,
  },
    h('div', { class: 'y-axis' }, [ceiling, ceiling / 2, 0].map((value) => h('span', {}, String(Math.round(value))))),
    h('div', { class: 'plot' }, h('i', { class: 'gridline mid' }), h('div', { class: 'cols' }, columns)),
    h('div', { class: 'x-axis' }, monthMarks));
  const legend = h('ul', { class: 'legend' }, areas.map((area, index) => h('li', {}, swatch(index), `${area.title} `, h('span', { class: 'muted' }, plural(area.total, 'commit')))));
  return card('Where the effort went', 'Commits per week, by area, for the last 52 weeks.', chart, legend);
}

// ---- Releases per month
export function releasesCard(data) {
  const months = releasesByMonth(data.projects, data.generatedAt);
  const ceiling = niceMax(Math.max(...months.map((month) => month.count), 1));
  const total = months.reduce((sum, month) => sum + month.count, 0);

  const columns = months.map((month) => {
    const bar = h('div', { class: 'bar' });
    bar.style.height = `${(month.count / ceiling) * 100}%`;
    // The count sits above the bar, not inside it (the column stacks upwards from the bottom).
    return h('div', { class: 'col', title: `${month.key}: ${plural(month.count, 'release')}` }, bar, month.count ? h('span', { class: 'value' }, String(month.count)) : null);
  });
  const chart = h('div', {
    class: 'bars months', role: 'img',
    'aria-label': `Releases per month over the last 12 months: ${months.filter((month) => month.count > 0).map((month) => `${month.label} ${month.count}`).join(', ') || 'none'}.`,
  },
    h('div', { class: 'y-axis' }, [ceiling, ceiling / 2, 0].map((value) => h('span', {}, String(Math.round(value))))),
    h('div', { class: 'plot' }, h('i', { class: 'gridline mid' }), h('div', { class: 'cols' }, columns)),
    h('div', { class: 'x-axis month-names' }, months.map((month) => h('span', {}, month.label))));
  return card('Releases per month', `${plural(total, 'release')} in the last 12 months.`, chart);
}

// ---- Status split and the most used tags
export function statusCard(data) {
  const counts = statusCounts(data.projects);
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  const bar = h('div', { class: 'seg', role: 'img', 'aria-label': counts.map((entry) => `${STATUS_LABELS[entry.status]} ${entry.count}`).join(', ') },
    counts.map((entry) => { const part = h('span', { class: `seg-${entry.status}` }); part.style.width = `${(entry.count / total) * 100}%`; return part; }));
  const legend = h('ul', { class: 'legend' }, counts.map((entry) => h('li', {}, h('span', { class: `swatch seg-${entry.status}`, 'aria-hidden': 'true' }), `${STATUS_LABELS[entry.status]} `, h('span', { class: 'muted' }, String(entry.count)))));
  return card('Where each project stands', null, bar, legend);
}

export function tagsCard(data, onTag) {
  const tags = tagCounts(data.projects, 10);
  const most = Math.max(...tags.map((entry) => entry.count), 1);
  const rows = tags.map((entry) => {
    const fill = h('span', { class: 'track-fill' });
    fill.style.width = `${(entry.count / most) * 100}%`;
    const row = h('button', { type: 'button', class: 'tag-bar', 'aria-label': `Show projects tagged ${entry.tag} (${entry.count})` },
      h('span', { class: 'tag-name' }, entry.tag), h('span', { class: 'track', 'aria-hidden': 'true' }, fill), h('span', { class: 'tag-count' }, String(entry.count)));
    row.addEventListener('click', () => onTag(entry.tag));
    return h('li', {}, row);
  });
  return card('Most used tags', 'Select a tag to filter the list above.', h('ul', { class: 'tag-bars' }, rows));
}

// ---- A spec table: one row per area
export function areaTableCard(data, now) {
  const rows = areaRows(data.projects, data.groups);
  const numeric = (value) => h('td', { class: 'num' }, formatCount(value));
  const head = h('tr', {}, [['Area', ''], ['Projects', 'num'], ['Released', 'num'], ['Releases', 'num'], ['Commits, 52 weeks', 'num'], ['Main languages', ''], ['Last active', '']]
    .map(([label, kind]) => h('th', { scope: 'col', class: kind }, label)));
  const body = rows.map((row) => {
    const name = h('th', { scope: 'row', class: row.depth === 0 ? 'total' : '' }, row.title);
    name.style.setProperty('--depth', Math.max(0, row.depth - 1));
    return h('tr', { class: row.depth === 0 ? 'total' : '' }, name, numeric(row.projects), numeric(row.released), numeric(row.releases), numeric(row.commits),
      h('td', {}, row.languages.join(', ')), h('td', {}, h('time', { datetime: row.lastActive, title: formatDate(row.lastActive) }, relativeTime(row.lastActive, now))));
  });
  return h('div', { class: 'card span-2' }, h('h3', {}, 'By area'),
    h('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Summary by area, scrolls sideways' },
      h('table', { class: 'spec' }, h('thead', {}, head), h('tbody', {}, body))));
}
