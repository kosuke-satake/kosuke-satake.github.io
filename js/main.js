document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('./data/data.json');
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    renderDashboard(await response.json());
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showLoadError();
  }
});

function showLoadError() {
  document.getElementById('name').textContent = 'Data unavailable';
  document.getElementById('load-error').hidden = false;
}

// Build elements with the DOM API so that text from GitHub is never parsed as HTML.
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null && value !== false) node.setAttribute(name, value);
  }
  node.append(...children.filter((child) => child !== undefined && child !== null && child !== false));
  return node;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function externalLink(href, text) {
  const url = safeUrl(href);
  if (!url) return document.createTextNode(text);
  return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, text);
}

function formatSize(kilobytes) {
  return kilobytes < 1024 ? `${kilobytes} KB` : `${(kilobytes / 1024).toFixed(1)} MB`;
}

function renderEmpty(container, text) {
  container.append(h('p', { class: 'empty-state' }, text));
}

function renderDashboard(data) {
  const { profile, pinnedRepositories, repositories, languages, topics, activity, calendar, lastFetched } = data;

  // Profile
  document.getElementById('name').textContent = profile.name || profile.username;
  document.getElementById('bio').textContent = profile.bio || '';
  document.getElementById('followers').textContent = profile.followers.toLocaleString();
  document.getElementById('following').textContent = profile.following.toLocaleString();

  const avatar = document.getElementById('avatar');
  const avatarUrl = safeUrl(profile.avatarUrl);
  if (avatarUrl) {
    avatar.src = avatarUrl;
    avatar.style.display = 'block';
  }

  const githubLink = document.getElementById('github-link');
  const profileUrl = safeUrl(profile.url);
  if (profileUrl) {
    githubLink.href = profileUrl;
    githubLink.style.display = 'inline-block';
  }

  // Account Meta
  document.getElementById('total-repos').textContent = `${profile.totalRepos} repositories`;
  document.getElementById('total-stars').textContent = `${profile.totalStars} stars`;
  const joinDate = new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  document.getElementById('joined-date').textContent = `Joined ${joinDate}`;

  // Insights
  document.getElementById('insight-contributions').textContent = calendar ? calendar.totalContributions.toLocaleString() : '0';
  document.getElementById('insight-prs').textContent = profile.totalPRs.toLocaleString();
  document.getElementById('insight-issues').textContent = profile.totalIssues.toLocaleString();
  document.getElementById('insight-stars').textContent = profile.totalStars.toLocaleString();
  document.getElementById('insight-forks').textContent = profile.totalForks.toLocaleString();
  document.getElementById('insight-starred').textContent = profile.totalStarred.toLocaleString();
  document.getElementById('insight-storage').textContent = formatSize(profile.totalDiskUsage);

  // Last Fetched
  const fetchDate = new Date(lastFetched);
  document.getElementById('last-fetched').textContent = `Data last updated: ${fetchDate.toLocaleString()}`;

  // Calendar
  renderCalendar(calendar);

  // Analysis Charts
  renderBarChart('languages-chart', languages, (item) => item.name, (item) => item.count, profile.totalRepos);
  renderBarChart('topics-chart', topics, (item) => item.name, (item) => item.count, profile.totalRepos);

  // Pinned Repositories
  const pinnedContainer = document.getElementById('pinned-container');
  if (pinnedRepositories.length > 0) {
    pinnedContainer.append(...pinnedRepositories.map(createRepoCard));
  } else {
    pinnedContainer.closest('.content-section').hidden = true;
  }

  // Activity Horizontal
  const activityContainer = document.getElementById('activity-container');
  if (activity && activity.length > 0) {
    activityContainer.append(...activity.map(createActivityItem));
  } else {
    renderEmpty(activityContainer, 'No recent commits.');
  }

  // All Repositories: most starred first, then most recently pushed
  const reposContainer = document.getElementById('repos-container');
  if (repositories.length > 0) {
    const ordered = [...repositories].sort(
      (a, b) => b.stars - a.stars || new Date(b.pushedAt) - new Date(a.pushedAt),
    );
    reposContainer.append(...ordered.map(createRepoCard));
  } else {
    renderEmpty(reposContainer, 'No public repositories yet.');
  }
}

function createActivityItem(item) {
  const date = new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const subject = String(item.message).split('\n')[0];
  return h('div', { class: 'activity-item' },
    h('p', { class: 'activity-msg' }, externalLink(item.url, subject)),
    h('p', { class: 'activity-meta' }, 'in ', h('strong', {}, item.repoName), ` • ${date}`),
  );
}

function createRepoCard(repo) {
  const meta = h('div', { class: 'repo-meta' });
  if (repo.language) {
    const dot = h('span', { class: 'lang-color' });
    if (repo.languageColor) dot.style.backgroundColor = repo.languageColor;
    meta.append(h('span', {}, dot, repo.language));
  }
  meta.append(
    h('span', {}, `★ ${repo.stars}`),
    h('span', {}, `⑂ ${repo.forks}`),
    h('span', {}, formatSize(repo.diskUsage)),
  );

  return h('div', { class: 'repo-card' },
    h('h3', {}, externalLink(repo.url, repo.name)),
    h('p', { class: 'repo-desc' }, repo.description || ''),
    meta,
    h('div', { class: 'repo-topics' }, ...repo.topics.map((topic) => h('span', { class: 'topic' }, topic))),
  );
}

function renderBarChart(containerId, items, labelFn, valueFn, total) {
  const container = document.getElementById(containerId);
  if (!items || items.length === 0) {
    renderEmpty(container, 'No data yet.');
    return;
  }

  const maxVal = Math.max(...items.map(valueFn));

  items.slice(0, 5).forEach(item => {
    const val = valueFn(item);
    const percentage = total ? Math.round((val / total) * 100) : 0;
    const fill = h('div', { class: 'chart-bar-fill' });
    fill.style.width = `${(val / maxVal) * 100}%`;
    container.append(
      h('div', { class: 'chart-row' },
        h('div', { class: 'chart-label' },
          h('span', {}, labelFn(item)),
          h('span', {}, `${val} (${percentage}%)`),
        ),
        h('div', { class: 'chart-bar-bg' }, fill),
      ),
    );
  });
}

// GitHub's API reports each day's level as a color from its light palette.
// Map those to levels so the calendar can be drawn with the dark palette.
const LEVEL_BY_API_COLOR = {
  '#ebedf0': 0,
  '#9be9a8': 1,
  '#40c463': 2,
  '#30a14e': 3,
  '#216e39': 4,
};

function contributionLevel(day) {
  if (day.contributionCount === 0) return 0;
  return LEVEL_BY_API_COLOR[String(day.color).toLowerCase()] ?? 1;
}

function renderCalendar(calendar) {
  if (!calendar) return;

  document.getElementById('total-contributions').textContent = `${calendar.totalContributions} total`;
  const container = document.getElementById('calendar-container');
  container.replaceChildren();

  calendar.weeks.forEach(week => {
    const weekEl = h('div', { class: 'calendar-week' });

    week.contributionDays.forEach(day => {
      weekEl.append(h('div', {
        class: `calendar-day level-${contributionLevel(day)}`,
        title: `${day.contributionCount} contributions on ${day.date}`,
      }));
    });

    container.append(weekEl);
  });

  // On narrow screens the calendar scrolls inside its box: show the latest weeks first.
  const wrapper = container.closest('.calendar-wrapper');
  if (wrapper) wrapper.scrollLeft = wrapper.scrollWidth;
}
