// Turns the GitHub API response and the catalog into the data the page renders (data/data.json, schema 2).
// Everything here is pure: no network, no file access, so it can be tested with fixtures.

export const SCHEMA_VERSION = 3;
export const WEEKS = 52;
const MS_PER_DAY = 86_400_000;
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const PROJECT_FIELDS = `
  fragment ProjectFields on Repository {
    nameWithOwner
    name
    description
    url
    homepageUrl
    createdAt
    pushedAt
    isArchived
    stargazerCount
    forkCount
    licenseInfo { spdxId }
    primaryLanguage { name color }
    languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
      totalSize
      edges { size node { name color } }
    }
    repositoryTopics(first: 12) { nodes { topic { name } } }
    releases(first: 50, orderBy: { field: CREATED_AT, direction: DESC }) {
      totalCount
      nodes { tagName name publishedAt url isPrerelease }
    }
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 15) {
            nodes { message committedDate url author { name } }
          }
        }
      }
    }
  }
`;

// Commits by GitHub Actions or other bots are not the owner's activity.
export function isAutomatedCommit(commit) {
  return /\[bot\]$/.test(commit.author?.name ?? '');
}

// A merge commit records that branches were joined, not what was done.
export function isMergeCommit(commit) {
  return /^Merge (branch|pull request|remote-tracking branch|tag) /.test(String(commit.message));
}

// One query for the profile, the calendar, the per-repository activity and every listed project. Owner and name
// travel as variables, never inside the query text.
export function buildRequest(catalog, login) {
  const listed = catalog.projects.filter((project) => !project.hidden);
  const declarations = ['$login: String!'];
  const aliases = [];
  const variables = { login };
  listed.forEach((project, index) => {
    const [owner, name] = project.repo.split('/');
    declarations.push(`$o${index}: String!`, `$n${index}: String!`);
    aliases.push(`p${index}: repository(owner: $o${index}, name: $n${index}) { ...ProjectFields }`);
    variables[`o${index}`] = owner;
    variables[`n${index}`] = name;
  });

  const query = `
    query(${declarations.join(', ')}) {
      user(login: $login) {
        login
        name
        avatarUrl
        bio
        url
        createdAt
        followers { totalCount }
        following { totalCount }
        repositories(first: 100, privacy: PUBLIC, isFork: false, ownerAffiliations: OWNER) {
          nodes { name }
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { contributionCount contributionLevel date } }
          }
          commitContributionsByRepository(maxRepositories: 100) {
            repository { nameWithOwner }
            contributions(first: 100, orderBy: { field: OCCURRED_AT, direction: DESC }) {
              nodes { commitCount occurredAt }
            }
          }
        }
      }
      ${aliases.join('\n      ')}
    }
    ${PROJECT_FIELDS}
  `;
  return { query, variables };
}

// Commits per week for the last `weeks` weeks, oldest first. Week 0 of the age is the most recent seven days.
export function weeklyBins(entries, now, weeks = WEEKS) {
  const bins = new Array(weeks).fill(0);
  for (const entry of entries) {
    const age = Math.max(0, Math.floor((now - new Date(entry.occurredAt)) / (7 * MS_PER_DAY)));
    if (age < weeks) bins[weeks - 1 - age] += entry.commitCount;
  }
  return bins;
}

function buildProject(entry, repo, activityEntries, now) {
  const history = repo.defaultBranchRef?.target?.history?.nodes ?? [];
  const humanCommits = history.filter((commit) => !isAutomatedCommit(commit));
  const recent = humanCommits.filter((commit) => !isMergeCommit(commit)).slice(0, 3).map((commit) => ({
    subject: String(commit.message).split('\n')[0],
    date: commit.committedDate,
    url: commit.url,
  }));

  const dated = [];
  if (humanCommits[0]) dated.push([humanCommits[0].committedDate, 'commit']);
  if (activityEntries[0]) dated.push([activityEntries[0].occurredAt, 'contribution']);
  dated.sort((a, b) => new Date(b[0]) - new Date(a[0]));
  const [lastActive, lastActiveFrom] = dated[0] ?? [repo.pushedAt, 'push'];

  const weekly = weeklyBins(activityEntries, now);
  const within = (days) => activityEntries
    .filter((item) => now - new Date(item.occurredAt) <= days * MS_PER_DAY)
    .reduce((sum, item) => sum + item.commitCount, 0);

  const totalSize = repo.languages?.totalSize ?? 0;
  const published = (repo.releases?.nodes ?? []).filter((node) => node.publishedAt);
  const latest = published[0] ?? null;
  const licence = repo.licenseInfo?.spdxId;

  return {
    id: repo.nameWithOwner,
    owner: repo.nameWithOwner.split('/')[0],
    name: repo.name,
    url: repo.url,
    homepage: repo.homepageUrl || null,
    summary: entry.summary ?? repo.description ?? '',
    group: entry.group,
    status: entry.status,
    featured: entry.featured === true,
    tags: entry.tags ?? [],
    topics: (repo.repositoryTopics?.nodes ?? []).map((node) => node.topic.name),
    language: repo.primaryLanguage ? { name: repo.primaryLanguage.name, color: repo.primaryLanguage.color } : null,
    languages: (repo.languages?.edges ?? []).map((edge) => ({
      name: edge.node.name,
      color: edge.node.color,
      bytes: edge.size,
      share: totalSize ? edge.size / totalSize : 0,
    })),
    license: licence && licence !== 'NOASSERTION' ? licence : null,
    archived: repo.isArchived,
    stars: repo.stargazerCount,
    forks: repo.forkCount,
    createdAt: repo.createdAt,
    pushedAt: repo.pushedAt,
    lastActive,
    lastActiveFrom,
    commits: {
      last90d: within(90),
      last52w: weekly.reduce((sum, count) => sum + count, 0),
      activeDays: activityEntries.filter((item) => now - new Date(item.occurredAt) <= WEEKS * 7 * MS_PER_DAY).length,
    },
    weekly,
    releases: {
      count: repo.releases?.totalCount ?? 0,
      latest: latest
        ? { tag: latest.tagName, name: latest.name, publishedAt: latest.publishedAt, url: latest.url, prerelease: latest.isPrerelease }
        : null,
      // Every published release, newest first, for the timeline and the releases-per-month chart.
      history: published.map((node) => ({ tag: node.tagName, publishedAt: node.publishedAt, prerelease: node.isPrerelease })),
    },
    recent,
  };
}

function languageTotals(projects) {
  const bytes = new Map();
  const colors = new Map();
  for (const project of projects) {
    for (const language of project.languages) {
      bytes.set(language.name, (bytes.get(language.name) ?? 0) + language.bytes);
      if (language.color) colors.set(language.name, language.color);
    }
  }
  const total = [...bytes.values()].reduce((sum, value) => sum + value, 0);
  const ranked = [...bytes.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 6).map(([name, size]) => ({ name, color: colors.get(name) ?? null, share: total ? size / total : 0 }));
  const otherShare = total ? ranked.slice(6).reduce((sum, [, size]) => sum + size, 0) / total : 0;
  return { top, otherShare };
}

// Returns { data, warnings }. Warnings are problems the owner can fix; they never stop the build.
export function buildData({ response, catalog, login, now = new Date() }) {
  const warnings = [];
  const user = response.data?.user;
  if (!user) throw new Error(`GitHub user "${login}" was not found.`);

  const activity = new Map();
  for (const item of user.contributionsCollection.commitContributionsByRepository) {
    activity.set(item.repository.nameWithOwner.toLowerCase(), item.contributions.nodes);
  }

  const listed = catalog.projects.filter((project) => !project.hidden);
  const projects = [];
  listed.forEach((entry, index) => {
    const repo = response.data[`p${index}`];
    if (!repo) {
      warnings.push(`${entry.repo}: not found or not public, so it is skipped.`);
      return;
    }
    const project = buildProject(entry, repo, activity.get(repo.nameWithOwner.toLowerCase()) ?? [], now);
    if (!project.summary) warnings.push(`${entry.repo}: has no summary. Add one to the catalog or a description on GitHub.`);
    else if (/\bTODO\b/.test(project.summary)) warnings.push(`${entry.repo}: the summary still says TODO and would be published as it is.`);
    projects.push(project);
  });

  const listedNames = new Set(catalog.projects.map((project) => project.repo.toLowerCase()));
  const unsorted = user.repositories.nodes
    .filter((repo) => !listedNames.has(`${user.login}/${repo.name}`.toLowerCase()))
    .map((repo) => ({ name: repo.name, url: `${user.url}/${repo.name}` }));
  for (const repo of unsorted) warnings.push(`${user.login}/${repo.name}: is public but not in the catalog.`);

  const weeks = user.contributionsCollection.contributionCalendar.weeks.map((week) =>
    week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount, level: LEVELS[day.contributionLevel] ?? 0 })),
  );
  const days = weeks.flat();
  const calendar = {
    total: user.contributionsCollection.contributionCalendar.totalContributions,
    activeDays: days.filter((day) => day.count > 0).length,
    weeks,
  };

  const activeSince = (days90) => projects.filter((project) => now - new Date(project.lastActive) <= days90 * MS_PER_DAY).length;
  const languages = languageTotals(projects);

  const data = {
    schema: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    // The start of each of the 52 weekly bins in `projects[].weekly`, oldest first.
    weekStarts: Array.from({ length: WEEKS }, (_, index) => new Date(now.getTime() - (WEEKS - index) * 7 * MS_PER_DAY).toISOString()),
    profile: {
      login: user.login,
      name: catalog.profile?.name || user.name || user.login,
      avatarUrl: user.avatarUrl,
      bio: user.bio || '',
      url: user.url,
      createdAt: user.createdAt,
      followers: user.followers.totalCount,
      tagline: catalog.profile?.tagline ?? '',
      links: catalog.profile?.links ?? [],
    },
    groups: catalog.groups.map((path) => ({ path, title: path.split('/').at(-1), depth: path.split('/').length })),
    projects,
    unsorted,
    stats: {
      projects: projects.length,
      released: projects.filter((project) => project.status === 'released').length,
      releases: projects.reduce((sum, project) => sum + project.releases.count, 0),
      active90: activeSince(90),
      languages: languages.top,
      otherLanguageShare: languages.otherShare,
    },
    calendar,
  };
  return { data, warnings };
}
