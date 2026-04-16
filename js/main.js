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
  const { profile, repositories, languages, activity, calendar, lastFetched } = data;
  
  // Profile
  document.getElementById('name').textContent = profile.name || profile.username;
  document.getElementById('bio').textContent = profile.bio || '';
  document.getElementById('followers').textContent = profile.followers;
  document.getElementById('following').textContent = profile.following;
  
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

  // Last Fetched
  const fetchDate = new Date(lastFetched);
  document.getElementById('last-fetched').textContent = `Data last updated: ${fetchDate.toLocaleString()}`;

  // Calendar
  renderCalendar(calendar);

  // Languages
  const langContainer = document.getElementById('languages-container');
  languages.forEach(lang => {
    const pill = document.createElement('div');
    pill.className = 'language-pill';
    pill.innerHTML = `
      <span class="lang-color" style="background-color: ${lang.color || '#ccc'}"></span>
      <span>${lang.name} <span style="color: var(--muted-color)">(${lang.count})</span></span>
    `;
    langContainer.appendChild(pill);
  });

  // Activity
  const activityContainer = document.getElementById('activity-container');
  if (activity && activity.length > 0) {
    activity.forEach(item => {
      const entry = document.createElement('div');
      entry.className = 'activity-item';
      const date = new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      entry.innerHTML = `
        <div class="activity-dot"></div>
        <div class="activity-content">
          <p class="activity-msg"><a href="${item.url}" target="_blank">${item.message}</a></p>
          <p class="activity-meta">in ${item.repoName} • ${date}</p>
        </div>
      `;
      activityContainer.appendChild(entry);
    });
  }

  // Repositories
  const reposContainer = document.getElementById('repos-container');
  repositories.forEach(repo => {
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
        <span>Updated ${date}</span>
      </div>
      <div class="repo-topics">${topicsHtml}</div>
    `;
    reposContainer.appendChild(card);
  });
}

function renderCalendar(calendar) {
  if (!calendar) return;

  document.getElementById('total-contributions').textContent = `${calendar.totalContributions} total`;
  const container = document.getElementById('calendar-container');
  
  calendar.weeks.forEach(week => {
    const weekEl = document.createElement('div');
    weekEl.className = 'calendar-week';
    
    week.contributionDays.forEach(day => {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.style.backgroundColor = day.color;
      dayEl.title = `${day.contributionCount} contributions on ${day.date}`;
      weekEl.appendChild(dayEl);
    });
    
    container.appendChild(weekEl);
  });
}
