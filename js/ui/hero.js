import { h, externalLink, safeUrl } from '../lib/dom.js';
import { formatCount } from '../lib/format.js';

export function renderHero(root, data) {
  const { profile, stats } = data;
  const avatarUrl = safeUrl(profile.avatarUrl);
  const facts = [
    ['Projects', stats.projects],
    ['Released', stats.released],
    ['Releases', stats.releases],
    ['Active in 90 days', stats.active90],
  ];
  root.replaceChildren(
    h('div', { class: 'hero-main' },
      avatarUrl ? h('img', { class: 'avatar', src: avatarUrl, alt: `${profile.name} on GitHub`, width: 96, height: 96 }) : null,
      h('div', {},
        h('h1', {}, profile.name),
        profile.tagline ? h('p', { class: 'tagline' }, profile.tagline) : null,
        h('ul', { class: 'hero-links', 'aria-label': 'Links' }, profile.links.map((link) => h('li', {}, externalLink(link.url, link.label)))))),
    h('dl', { class: 'facts' }, facts.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, formatCount(value))))),
  );
}
