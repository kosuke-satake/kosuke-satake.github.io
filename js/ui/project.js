import { h, externalLink } from '../lib/dom.js';
import { STATUS_LABELS } from '../lib/filter.js';
import { formatCount, formatDate, plural, relativeTime } from '../lib/format.js';

const SVG = 'http://www.w3.org/2000/svg';

// Commits per week for the last 52 weeks, as a tiny bar chart.
export function sparkline(weekly, label) {
  const bar = 2;
  const gap = 1;
  const height = 28;
  const width = weekly.length * (bar + gap) - gap;
  const max = Math.max(...weekly, 1);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('class', 'spark');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  weekly.forEach((count, index) => {
    const barHeight = count ? Math.max(3, Math.round((count / max) * height)) : 1;
    const rect = document.createElementNS(SVG, 'rect');
    rect.setAttribute('x', index * (bar + gap));
    rect.setAttribute('y', height - barHeight);
    rect.setAttribute('width', bar);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('class', count ? 'on' : 'off');
    svg.append(rect);
  });
  return svg;
}

function metaItem(label, ...content) {
  return h('div', {}, h('dt', { class: 'sr-only' }, label), h('dd', {}, ...content));
}

// One project as a list item. `showPath` adds the area when the list is not grouped by area.
export function projectItem(project, { now, showPath = false, featured = false }) {
  const release = project.releases.latest;
  const spelled = new Map(); // a tag and a topic that differ only in letter case are shown once, as the catalog spells it
  for (const tag of [...project.tags, ...project.topics]) if (!spelled.has(tag.toLowerCase())) spelled.set(tag.toLowerCase(), tag);
  const tags = [...spelled.values()];

  const dot = project.language ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : null;
  if (dot && project.language.color) dot.style.backgroundColor = project.language.color;

  const commits = project.commits.last52w;
  return h('li', { class: `project${featured ? ' featured' : ''}`, 'data-status': project.status },
    h('article', {},
      h('header', { class: 'project-head' },
        h('h3', { class: 'project-name' }, externalLink(project.url, project.name)),
        h('span', { class: `badge status-${project.status}` }, STATUS_LABELS[project.status] ?? project.status),
        release ? externalLink(release.url, release.tag, { class: 'version', title: `Latest release, ${formatDate(release.publishedAt)}` }) : null,
      ),
      showPath ? h('p', { class: 'path' }, project.group.replaceAll('/', ' / ')) : null,
      h('p', { class: 'summary' }, project.summary),
      tags.length > 0 ? h('ul', { class: 'tags', 'aria-label': 'Tags' },
        tags.slice(0, 6).map((tag) => h('li', {}, h('button', { type: 'button', class: 'tag', 'data-tag': tag, 'aria-label': `Filter by tag ${tag}` }, tag)))) : null,
      h('dl', { class: 'meta' },
        project.language ? metaItem('Main language', dot, project.language.name) : null,
        metaItem('Last activity', h('time', { datetime: project.lastActive, title: formatDate(project.lastActive) }, relativeTime(project.lastActive, now))),
        metaItem('Releases', project.releases.count > 0 ? plural(project.releases.count, 'release') : 'No releases'),
        metaItem('Commits in the last 52 weeks',
          sparkline(project.weekly, `${plural(commits, 'commit')} in the last 52 weeks`),
          h('span', { class: 'spark-total' }, formatCount(commits))),
      ),
      project.homepage ? h('p', { class: 'links' }, externalLink(project.homepage, 'Website')) : null,
    ),
  );
}
