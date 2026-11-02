import { h } from '../lib/dom.js';
import { formatCount, formatDate, plural } from '../lib/format.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function calendar(data) {
  const { weeks, total, activeDays } = data.calendar;
  const days = weeks.flat();
  const scroll = h('div', { class: 'calendar-scroll' });
  const months = h('div', { class: 'cal-months', 'aria-hidden': 'true' });
  const grid = h('div', {
    class: 'cal-grid', role: 'img',
    'aria-label': `${formatCount(total)} contributions on ${activeDays} days between ${days[0].date} and ${days.at(-1).date}`,
  });

  let previous = -1;
  weeks.forEach((week, index) => {
    const month = Number(week[0].date.slice(5, 7)) - 1;
    if (month !== previous && index < weeks.length - 2) {
      const label = h('span', {}, MONTHS[month]);
      label.style.gridColumnStart = index + 1;
      months.append(label);
    }
    previous = month;
    grid.append(h('div', { class: 'cal-week' }, week.map((day) => h('div', { class: `cal-day level-${day.level}`, title: `${day.count} contributions on ${day.date}` }))));
  });
  scroll.append(months, grid);

  const legend = h('div', { class: 'cal-legend', 'aria-hidden': 'true' },
    h('span', {}, 'Less'), [0, 1, 2, 3, 4].map((level) => h('span', { class: `cal-day level-${level}` })), h('span', {}, 'More'));
  const card = h('div', { class: 'card calendar' }, scroll, legend);
  // On a narrow screen the grid scrolls inside its card; show the latest weeks first.
  requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
  return card;
}

function latestReleases(projects) {
  const released = projects.filter((project) => project.releases.latest)
    .sort((a, b) => new Date(b.releases.latest.publishedAt) - new Date(a.releases.latest.publishedAt))
    .slice(0, 6);
  return h('div', { class: 'card' },
    h('h3', {}, 'Latest releases'),
    h('ul', { class: 'release-list' }, released.map((project) => h('li', {},
      h('a', { href: project.releases.latest.url, target: '_blank', rel: 'noopener noreferrer' }, project.name),
      h('span', { class: 'version' }, project.releases.latest.tag),
      h('time', { datetime: project.releases.latest.publishedAt }, formatDate(project.releases.latest.publishedAt))))),
  );
}

function languages(stats) {
  const parts = [...stats.languages];
  if (stats.otherLanguageShare > 0.005) parts.push({ name: 'Other', color: null, share: stats.otherLanguageShare });
  const bar = h('div', { class: 'stack', role: 'img', 'aria-label': parts.map((part) => `${part.name} ${Math.round(part.share * 100)}%`).join(', ') },
    parts.map((part) => {
      const segment = h('span', {});
      segment.style.width = `${(part.share * 100).toFixed(2)}%`;
      segment.style.backgroundColor = part.color ?? 'var(--border-strong)';
      return segment;
    }));
  const legend = h('ul', { class: 'legend' }, parts.map((part) => {
    const dot = h('span', { class: 'dot', 'aria-hidden': 'true' });
    dot.style.backgroundColor = part.color ?? 'var(--border-strong)';
    return h('li', {}, dot, `${part.name} `, h('span', { class: 'muted' }, `${Math.round(part.share * 100)}%`));
  }));
  return h('div', { class: 'card' }, h('h3', {}, 'Languages, by code size'), bar, legend);
}

export function renderActivity(root, data) {
  root.replaceChildren(
    h('h2', { id: 'activity-title' }, 'Activity and stack'),
    h('p', { class: 'section-note' }, `${formatCount(data.calendar.total)} public contributions in the last 12 months, on ${plural(data.calendar.activeDays, 'day')}. Commits by bots are not counted.`),
    h('div', { class: 'activity-grid' }, calendar(data), latestReleases(data.projects), languages(data.stats)),
  );
  root.hidden = false;
}
