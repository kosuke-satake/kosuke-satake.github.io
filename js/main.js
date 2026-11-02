import { externalLink, h } from './lib/dom.js';
import { searchFromState, stateFromSearch } from './lib/url-state.js';
import { renderActivity } from './ui/activity.js';
import { renderHero } from './ui/hero.js';
import { projectItem } from './ui/project.js';
import { initWork } from './ui/work.js';

const SOURCE = 'https://github.com/kosuke-satake/kosuke-satake.github.io';

async function start() {
  const response = await fetch('./data/data.json');
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const data = await response.json();
  if (data.schema !== 2) throw new Error(`Unsupported data version ${data.schema}`);

  const now = new Date();
  const state = stateFromSearch(location.search);
  renderHero(document.getElementById('hero'), data);

  const featuredRoot = document.getElementById('featured');
  const featuredList = featuredRoot.querySelector('ul');
  const featured = data.projects.filter((project) => project.featured);
  featuredList.replaceChildren(...featured.map((project) => projectItem(project, { now, featured: true })));
  // Featured cards are only shown while no search or filter is active; the results take over then.
  const showFeatured = (current) => { featuredRoot.hidden = featured.length === 0 || current.q.trim() !== ''; };

  const work = initWork({
    root: document.getElementById('work'),
    data,
    now,
    state,
    onChange(current) {
      history.replaceState(null, '', `${location.pathname}${searchFromState(current)}${location.hash}`);
      showFeatured(current);
    },
  });
  showFeatured(state);
  featuredList.addEventListener('click', (event) => {
    const tag = event.target.closest('button.tag');
    if (tag) work.toggleFilter('tag', tag.dataset.tag);
  });

  renderActivity(document.getElementById('activity'), data);
  document.getElementById('footer').replaceChildren(
    h('p', {}, 'Figures come from the GitHub API and are refreshed every day. Commits by bots are not counted.'),
    h('p', {}, `Data last updated ${new Date(data.generatedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}. `, externalLink(SOURCE, 'Source code')),
  );
}

start().catch((error) => {
  console.error('Error loading dashboard data:', error);
  document.getElementById('hero').replaceChildren(h('h1', {}, 'Data unavailable'));
  document.getElementById('load-error').hidden = false;
});
