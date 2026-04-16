import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables for local development
try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (e) {
  // Ignore missing dotenv in production/GitHub Actions
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is not set.');
  process.exit(1);
}

const GRAPHQL_QUERY = `
  query {
    viewer {
      login
      name
      avatarUrl
      bio
      url
      followers {
        totalCount
      }
      following {
        totalCount
      }
      repositories(first: 50, privacy: PUBLIC, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
        nodes {
          name
          description
          url
          stargazerCount
          forkCount
          pushedAt
          primaryLanguage {
            name
            color
          }
          repositoryTopics(first: 5) {
            nodes {
              topic {
                name
              }
            }
          }
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 10) {
                  nodes {
                    message
                    committedDate
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchGitHubData() {
  console.log('Fetching GitHub data...');
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: GRAPHQL_QUERY }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GitHub API error: ${response.status} ${response.statusText}`, errorText);
    process.exit(1);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL Errors:', JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }

  const viewer = result.data.viewer;
  const allCommits = [];

  const repos = viewer.repositories.nodes.map(repo => {
    // Extract commits if they exist
    const repoCommits = repo.defaultBranchRef?.target?.history?.nodes || [];
    repoCommits.forEach(commit => {
      allCommits.push({
        repoName: repo.name,
        repoUrl: repo.url,
        message: commit.message,
        date: commit.committedDate,
        url: commit.url
      });
    });

    return {
      name: repo.name,
      description: repo.description,
      url: repo.url,
      stars: repo.stargazerCount,
      forks: repo.forkCount,
      pushedAt: repo.pushedAt,
      language: repo.primaryLanguage ? repo.primaryLanguage.name : null,
      languageColor: repo.primaryLanguage ? repo.primaryLanguage.color : null,
      topics: repo.repositoryTopics.nodes.map(node => node.topic.name)
    };
  });

  // Sort and slice all commits to get the most recent activity
  const recentActivity = allCommits
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  // Aggregate language stats
  const languages = {};
  for (const repo of repos) {
    if (repo.language) {
      if (!languages[repo.language]) {
        languages[repo.language] = { count: 0, color: repo.languageColor };
      }
      languages[repo.language].count++;
    }
  }

  const sortedLanguages = Object.entries(languages)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([name, data]) => ({ name, ...data }));

  const data = {
    profile: {
      username: viewer.login,
      name: viewer.name,
      avatarUrl: viewer.avatarUrl,
      bio: viewer.bio,
      url: viewer.url,
      followers: viewer.followers.totalCount,
      following: viewer.following.totalCount,
    },
    repositories: repos,
    languages: sortedLanguages,
    activity: recentActivity,
    lastFetched: new Date().toISOString(),
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dataDir = path.join(__dirname, '..', 'data');
  
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(data, null, 2));

  console.log('Successfully fetched and saved GitHub data to data/data.json.');
}

fetchGitHubData().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
