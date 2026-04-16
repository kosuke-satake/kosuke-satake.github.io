document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('./data/data.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    renderDashboard(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    document.getElementById('name').textContent = 'Error loading data.';
    document.getElementById('name').style.color = '#ff7b72';
  }
});

function renderDashboard(data) {
  const { profile, pinnedRepositories, repositories, languages, topics, activity, calendar, lastFetched } = data;
  
  // Profile
  document.getElementById('name').textContent = profile.name || profile.username;
  document.getElementById('bio').textContent = profile.bio || '';
  document.getElementById('followers').textContent = profile.followers.toLocaleString();
  document.getElementById('following').textContent = profile.following.toLocaleString();
  
  const avatar = document.getElementById('avatar');
  avatar.src = profile.avatarUrl;
  avatar.style.display = 'block';

  const githubLink = document.getElementById('github-link');
  githubLink.href = profile.url;
  githubLink.style.display = 'inline-block';

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
  
  // Storage Conversion
  const storageMB = (profile.totalDiskUsage / 1024).toFixed(1);
  document.getElementById('insight-storage').textContent = `${storageMB} MB`;

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
  pinnedRepositories.forEach(repo => {
    pinnedContainer.appendChild(createRepoCard(repo));
  });

  // Activity Horizontal
  const activityContainer = document.getElementById('activity-container');
  if (activity && activity.length > 0) {
    activity.forEach(item => {
      const entry = document.createElement('div');
      entry.className = 'activity-item';
      const date = new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      entry.innerHTML = `
        <p class="activity-msg"><a href="${item.url}" target="_blank">${item.message}</a></p>
        <p class="activity-meta">in <strong>${item.repoName}</strong> • ${date}</p>
      `;
      activityContainer.appendChild(entry);
    });
  }

  // All Repositories
  const reposContainer = document.getElementById('repos-container');
  repositories.forEach(repo => {
    reposContainer.appendChild(createRepoCard(repo));
  });
}

function createRepoCard(repo) {
  const card = document.createElement('div');
  card.className = 'repo-card';
  const topicsHtml = repo.topics.map(t => `<span class="topic">${t}</span>`).join('');
  const date = new Date(repo.pushedAt).toLocaleDateString();

  card.innerHTML = `
    <h3><a href="${repo.url}" target="_blank">${repo.name}</a></h3>
    <p class="repo-desc">${repo.description || ''}</p>
    <div class="repo-meta">
      ${repo.language ? `<span><span class="lang-color" style="background-color: ${repo.languageColor || '#ccc'}"></span>${repo.language}</span>` : ''}
      <span>★ ${repo.stars}</span>
      <span>⑂ ${repo.forks}</span>
      <span>${(repo.diskUsage / 1024).toFixed(1)} MB</span>
    </div>
    <div class="repo-topics">${topicsHtml}</div>
  `;
  return card;
}

function renderBarChart(containerId, items, labelFn, valueFn, total) {
  const container = document.getElementById(containerId);
  if (!items || items.length === 0) return;

  const maxVal = Math.max(...items.map(valueFn));

  items.slice(0, 5).forEach(item => {
    const val = valueFn(item);
    const percentage = ((val / total) * 100).toFixed(0);
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.innerHTML = `
      <div class="chart-label">
        <span>${labelFn(item)}</span>
        <span>${val} (${percentage}%)</span>
      </div>
      <div class="chart-bar-bg">
        <div class="chart-bar-fill" style="width: ${(val / maxVal) * 100}%"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderCalendar(calendar) {
  if (!calendar) return;

  document.getElementById('total-contributions').textContent = `${calendar.totalContributions} total`;
  const container = document.getElementById('calendar-container');
  container.innerHTML = '';
  
  calendar.weeks.forEach(week => {
    const weekEl = document.createElement('div');
    weekEl.className = 'calendar-week';
    
    week.contributionDays.forEach(day => {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      
      // Override empty days to dark gray
      const color = (day.contributionCount === 0 || day.color === '#ebedf0') ? '#161b22' : day.color;
      dayEl.style.backgroundColor = color;
      dayEl.title = `${day.contributionCount} contributions on ${day.date}`;
      weekEl.appendChild(dayEl);
    });
    
    container.appendChild(weekEl);
  });
}
