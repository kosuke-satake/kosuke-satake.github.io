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
  query($username: String!) {
    user(login: $username) {
      login
      name
      avatarUrl
      bio
      url
      createdAt
      followers {
        totalCount
      }
      following {
        totalCount
      }
      pullRequests {
        totalCount
      }
      issues {
        totalCount
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              color
            }
          }
        }
      }
      repositories(first: 100, privacy: PUBLIC, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          name
          description
          url
          stargazerCount
          forkCount
          diskUsage
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
    body: JSON.stringify({ 
      query: GRAPHQL_QUERY,
      variables: { username: 'kosuke-satake' } 
    }),
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

  const user = result.data.user;
  const allCommits = [];
  const topicCounts = {};

  const repos = user.repositories.nodes.map(repo => {
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

    // Extract topics
    repo.repositoryTopics.nodes.forEach(node => {
      const topicName = node.topic.name;
      topicCounts[topicName] = (topicCounts[topicName] || 0) + 1;
    });

    return {
      name: repo.name,
      description: repo.description,
      url: repo.url,
      stars: repo.stargazerCount,
      forks: repo.forkCount,
      diskUsage: repo.diskUsage,
      pushedAt: repo.pushedAt,
      language: repo.primaryLanguage ? repo.primaryLanguage.name : null,
      languageColor: repo.primaryLanguage ? repo.primaryLanguage.color : null,
      topics: repo.repositoryTopics.nodes.map(node => node.topic.name)
    };
  });

  // Sort and slice all commits to get the most recent activity across all repos
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

  // Sort topics by frequency
  const sortedTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const data = {
    profile: {
      username: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      url: user.url,
      createdAt: user.createdAt,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      totalRepos: user.repositories.totalCount,
      totalStars: repos.reduce((sum, r) => sum + r.stars, 0),
      totalPRs: user.pullRequests.totalCount,
      totalIssues: user.issues.totalCount,
      totalDiskUsage: repos.reduce((sum, r) => sum + r.diskUsage, 0), // in KB
    },
    calendar: user.contributionsCollection.contributionCalendar,
    repositories: repos,
    languages: sortedLanguages,
    topics: sortedTopics,
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
