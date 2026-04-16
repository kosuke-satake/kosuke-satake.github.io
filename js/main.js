document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('./data/data.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    renderDashboard(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    document.getElementById('name').textContent = 'Error loading data. Make sure to run the fetch script first.';
    document.getElementById('name').style.color = '#ff7b72';
  }
});

function renderDashboard(data) {
  // Profile
  const { profile, repositories, languages, lastFetched } = data;
  
  document.getElementById('name').textContent = profile.name || profile.username;
  document.getElementById('bio').textContent = profile.bio || '';
  document.getElementById('followers').textContent = `${profile.followers} followers`;
  document.getElementById('following').textContent = `${profile.following} following`;
  
  const avatar = document.getElementById('avatar');
  avatar.src = profile.avatarUrl;
  avatar.style.display = 'block';

  const githubLink = document.getElementById('github-link');
  githubLink.href = profile.url;
  githubLink.style.display = 'inline-block';

  // Last Fetched
  const fetchDate = new Date(lastFetched);
  document.getElementById('last-fetched').textContent = `Data last updated: ${fetchDate.toLocaleString()}`;

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

  // Repositories
  document.getElementById('repo-count').textContent = repositories.length;
  const reposContainer = document.getElementById('repos-container');
  
  repositories.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'repo-card';
    
    const topicsHtml = repo.topics.map(t => `<span class="topic">${t}</span>`).join('');
    
    // Format date roughly
    const date = new Date(repo.pushedAt).toLocaleDateString();

    card.innerHTML = `
      <h3><a href="${repo.url}" target="_blank">${repo.name}</a></h3>
      <p class="repo-desc">${repo.description || 'No description provided.'}</p>
      <div class="repo-meta">
        ${repo.language ? `<span><span class="lang-color" style="background-color: ${repo.languageColor || '#ccc'}"></span>${repo.language}</span>` : ''}
        <span>★ ${repo.stars}</span>
        <span>⑂ ${repo.forks}</span>
        <span>Updated: ${date}</span>
      </div>
      <div class="repo-topics">${topicsHtml}</div>
    `;
    reposContainer.appendChild(card);
  });
}
