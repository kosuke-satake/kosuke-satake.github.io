import test from 'node:test';
import assert from 'node:assert/strict';
import { buildData, buildRequest, isAutomatedCommit, weeklyBins } from '../scripts/lib/build-data.js';

const NOW = new Date('2026-11-02T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 86_400_000).toISOString();

const repo = (overrides = {}) => ({
  nameWithOwner: 'owner/app',
  name: 'app',
  description: 'From GitHub',
  url: 'https://github.com/owner/app',
  homepageUrl: '',
  createdAt: '2026-01-01T00:00:00Z',
  pushedAt: '2026-10-30T00:00:00Z',
  isArchived: false,
  stargazerCount: 0,
  forkCount: 0,
  licenseInfo: { spdxId: 'MIT' },
  primaryLanguage: { name: 'Swift', color: '#F05138' },
  languages: { totalSize: 100, edges: [{ size: 75, node: { name: 'Swift', color: '#F05138' } }, { size: 25, node: { name: 'Shell', color: null } }] },
  repositoryTopics: { nodes: [{ topic: { name: 'ios' } }] },
  releases: { totalCount: 2, nodes: [{ tagName: 'v1.1.0', name: 'One one', publishedAt: '2026-10-20T00:00:00Z', url: 'https://github.com/owner/app/releases/tag/v1.1.0', isPrerelease: false }] },
  defaultBranchRef: {
    target: {
      history: {
        nodes: [
          { message: 'chore(data): refresh\n\nbody', committedDate: '2026-11-01T00:00:00Z', url: 'u1', author: { name: 'github-actions[bot]' } },
          { message: 'feat: add thing\n\nlong body', committedDate: '2026-10-30T00:00:00Z', url: 'u2', author: { name: 'Kosuke Satake' } },
        ],
      },
    },
  },
  ...overrides,
});

const response = ({ repos = [repo()], activity = [], owned = ['app'], days } = {}) => ({
  data: {
    user: {
      login: 'owner',
      name: 'Owner Name',
      avatarUrl: 'https://example.com/a.png',
      bio: '',
      url: 'https://github.com/owner',
      createdAt: '2025-11-26T00:00:00Z',
      followers: { totalCount: 3 },
      following: { totalCount: 1 },
      repositories: { nodes: owned.map((name) => ({ name })) },
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 5,
          weeks: [{ contributionDays: days ?? [
            { contributionCount: 0, contributionLevel: 'NONE', date: '2026-11-01' },
            { contributionCount: 5, contributionLevel: 'FOURTH_QUARTILE', date: '2026-11-02' },
          ] }],
        },
        commitContributionsByRepository: activity,
      },
    },
    ...Object.fromEntries(repos.map((item, index) => [`p${index}`, item])),
  },
});

const catalog = (projects) => ({
  profile: { tagline: 'Hi', links: [{ label: 'GitHub', url: 'https://github.com/owner' }] },
  groups: ['Apps', 'Web'],
  projects: projects ?? [{ repo: 'owner/app', group: 'Apps', status: 'released', featured: true, tags: ['swift'] }],
});

const entry = (name, ...pairs) => ({
  repository: { nameWithOwner: name },
  contributions: { nodes: pairs.map(([when, commitCount]) => ({ occurredAt: when, commitCount })) },
});

const build = (options) => buildData({ login: 'owner', now: NOW, ...options });

test('the request names repositories only through variables', () => {
  const { query, variables } = buildRequest(catalog([
    { repo: 'owner/app', group: 'Apps', status: 'released' },
    { repo: 'org/tool', group: 'Web', status: 'learning' },
    { repo: 'owner/secret', hidden: true },
  ]), 'owner');
  assert.deepEqual(variables, { login: 'owner', o0: 'owner', n0: 'app', o1: 'org', n1: 'tool' });
  assert.match(query, /p0: repository\(owner: \$o0, name: \$n0\)/);
  assert.match(query, /p1: repository\(owner: \$o1, name: \$n1\)/);
  assert.doesNotMatch(query, /p2:/);
  assert.doesNotMatch(query, /owner\/app|secret|tool/);
});

test('catalog and API data are merged into one project', () => {
  const { data } = build({ response: response(), catalog: catalog() });
  const [project] = data.projects;
  assert.equal(project.id, 'owner/app');
  assert.equal(project.group, 'Apps');
  assert.equal(project.status, 'released');
  assert.equal(project.featured, true);
  assert.deepEqual(project.tags, ['swift']);
  assert.deepEqual(project.topics, ['ios']);
  assert.equal(project.license, 'MIT');
  assert.equal(project.homepage, null);
  assert.deepEqual(project.releases.latest, { tag: 'v1.1.0', name: 'One one', publishedAt: '2026-10-20T00:00:00Z', url: 'https://github.com/owner/app/releases/tag/v1.1.0', prerelease: false });
  assert.equal(project.releases.count, 2);
  assert.equal(project.languages[0].share, 0.75);
  assert.equal(data.schema, 2);
});

test('the summary comes from the catalog, else from the GitHub description', () => {
  const fromGitHub = build({ response: response(), catalog: catalog() }).data.projects[0];
  assert.equal(fromGitHub.summary, 'From GitHub');
  const own = catalog([{ repo: 'owner/app', group: 'Apps', status: 'released', summary: 'Written by hand' }]);
  assert.equal(build({ response: response(), catalog: own }).data.projects[0].summary, 'Written by hand');
});

test('a project without any summary is reported', () => {
  const { warnings } = build({ response: response({ repos: [repo({ description: null })] }), catalog: catalog() });
  assert.deepEqual(warnings, ['owner/app: has no summary. Add one to the catalog or a description on GitHub.']);
});

test('bot commits are left out of recent work and of the last activity', () => {
  const [project] = build({ response: response(), catalog: catalog() }).data.projects;
  assert.deepEqual(project.recent, [{ subject: 'feat: add thing', date: '2026-10-30T00:00:00Z', url: 'u2' }]);
  assert.equal(project.lastActive, '2026-10-30T00:00:00Z');
  assert.equal(project.lastActiveFrom, 'commit');
});

test('the last activity is the newest of the latest commit and the contribution record', () => {
  const activity = [entry('owner/app', [daysAgo(1), 2])];
  const [project] = build({ response: response({ activity }), catalog: catalog() }).data.projects;
  assert.equal(project.lastActive, daysAgo(1));
  assert.equal(project.lastActiveFrom, 'contribution');
});

test('with no human commit and no record, the last push is used', () => {
  const onlyBots = repo({ defaultBranchRef: { target: { history: { nodes: [{ message: 'x', committedDate: '2026-11-01T00:00:00Z', url: 'u', author: { name: 'github-actions[bot]' } }] } } } });
  const [project] = build({ response: response({ repos: [onlyBots] }), catalog: catalog() }).data.projects;
  assert.equal(project.lastActive, '2026-10-30T00:00:00Z');
  assert.equal(project.lastActiveFrom, 'push');
});

test('weekly bins count the last 52 weeks, oldest first, and clamp a record from today', () => {
  const entries = [
    { occurredAt: daysAgo(3), commitCount: 2 },
    { occurredAt: daysAgo(10), commitCount: 4 },
    { occurredAt: new Date(NOW.getTime() + 3_600_000).toISOString(), commitCount: 1 },
    { occurredAt: daysAgo(400), commitCount: 9 },
  ];
  const bins = weeklyBins(entries, NOW);
  assert.equal(bins.length, 52);
  assert.equal(bins[51], 3);
  assert.equal(bins[50], 4);
  assert.equal(bins.reduce((sum, count) => sum + count, 0), 7);
});

test('commit counts cover 90 days and 52 weeks, and active days are counted', () => {
  const activity = [entry('owner/app', [daysAgo(5), 3], [daysAgo(80), 2], [daysAgo(200), 4], [daysAgo(500), 7])];
  const { commits } = build({ response: response({ activity }), catalog: catalog() }).data.projects[0];
  assert.deepEqual(commits, { last90d: 5, last52w: 9, activeDays: 3 });
});

test('the contribution record is matched to the repository without regard to case', () => {
  const activity = [entry('Owner/App', [daysAgo(2), 6])];
  assert.equal(build({ response: response({ activity }), catalog: catalog() }).data.projects[0].commits.last90d, 6);
});

test('a repository that cannot be read is skipped with a warning', () => {
  const projects = [
    { repo: 'owner/app', group: 'Apps', status: 'released' },
    { repo: 'owner/gone', group: 'Apps', status: 'released' },
  ];
  const { data, warnings } = build({ response: response({ repos: [repo(), null], owned: ['app', 'gone'] }), catalog: catalog(projects) });
  assert.deepEqual(data.projects.map((project) => project.id), ['owner/app']);
  assert.deepEqual(warnings, ['owner/gone: not found or not public, so it is skipped.']);
});

test('hidden projects are not published and are not reported as unsorted', () => {
  const projects = [
    { repo: 'owner/app', group: 'Apps', status: 'released' },
    { repo: 'owner/scratch', hidden: true },
  ];
  const { data, warnings } = build({ response: response({ repos: [repo()], owned: ['app', 'scratch'] }), catalog: catalog(projects) });
  assert.equal(data.projects.length, 1);
  assert.deepEqual(data.unsorted, []);
  assert.deepEqual(warnings, []);
});

test('a public repository missing from the catalog is reported as unsorted', () => {
  const { data, warnings } = build({ response: response({ owned: ['App', 'brand-new'] }), catalog: catalog() });
  assert.deepEqual(data.unsorted, [{ name: 'brand-new', url: 'https://github.com/owner/brand-new' }]);
  assert.deepEqual(warnings, ['owner/brand-new: is public but not in the catalog.']);
});

test('the statistics are computed from the projects', () => {
  const projects = [
    { repo: 'owner/app', group: 'Apps', status: 'released' },
    { repo: 'owner/old', group: 'Web', status: 'learning' },
  ];
  const old = repo({ nameWithOwner: 'owner/old', name: 'old', releases: { totalCount: 0, nodes: [] }, pushedAt: '2025-01-01T00:00:00Z', defaultBranchRef: null, languages: { totalSize: 100, edges: [{ size: 100, node: { name: 'Python', color: '#3572A5' } }] } });
  const { data } = build({ response: response({ repos: [repo(), old], owned: ['app', 'old'] }), catalog: catalog(projects) });
  assert.equal(data.stats.projects, 2);
  assert.equal(data.stats.released, 1);
  assert.equal(data.stats.releases, 2);
  assert.equal(data.stats.active90, 1);
  assert.deepEqual(data.stats.languages.map((language) => [language.name, language.share]), [['Python', 0.5], ['Swift', 0.375], ['Shell', 0.125]]);
  assert.equal(data.stats.otherLanguageShare, 0);
});

test('the calendar keeps date, count and a 0-4 level, and counts active days', () => {
  const { calendar } = build({ response: response(), catalog: catalog() }).data;
  assert.deepEqual(calendar.weeks, [[{ date: '2026-11-01', count: 0, level: 0 }, { date: '2026-11-02', count: 5, level: 4 }]]);
  assert.equal(calendar.total, 5);
  assert.equal(calendar.activeDays, 1);
});

test('a missing GitHub user is an error', () => {
  const missing = { data: { user: null } };
  assert.throws(() => build({ response: missing, catalog: catalog() }), /user "owner" was not found/);
});

test('only authors that end in [bot] are automated', () => {
  assert.equal(isAutomatedCommit({ author: { name: 'github-actions[bot]' } }), true);
  assert.equal(isAutomatedCommit({ author: { name: 'dependabot[bot]' } }), true);
  assert.equal(isAutomatedCommit({ author: { name: 'google-labs-jules[bot]' } }), true);
  assert.equal(isAutomatedCommit({ author: { name: 'Kosuke Satake' } }), false);
  assert.equal(isAutomatedCommit({ author: { name: 'Abbott' } }), false);
  assert.equal(isAutomatedCommit({ author: { name: '[bot] fan' } }), false);
  assert.equal(isAutomatedCommit({ author: null }), false);
  assert.equal(isAutomatedCommit({}), false);
});
