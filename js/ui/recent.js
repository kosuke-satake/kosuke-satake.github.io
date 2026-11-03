import { externalLink, h } from '../lib/dom.js';
import { formatDate, relativeTime } from '../lib/format.js';
import { recentWork } from '../lib/stats.js';

// The latest commits by a person, with the project each belongs to. Returns how many were shown.
export function renderRecent(root, data, now) {
  const items = recentWork(data.projects, now);
  root.querySelector('ul').replaceChildren(...items.map((item) => h('li', {},
    externalLink(item.project.url, item.project.name, { class: 'recent-project' }),
    externalLink(item.url, item.subject, { class: 'recent-subject' }),
    h('time', { datetime: item.date, title: formatDate(item.date) }, relativeTime(item.date, now)))));
  return items.length;
}
