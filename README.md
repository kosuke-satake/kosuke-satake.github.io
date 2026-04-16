# GitHub Dashboard

A zero-maintenance, automated GitHub profile dashboard hosted on GitHub Pages.

## Overview
This repository serves as a dedicated portfolio strictly for GitHub activity. It replaces the standard GitHub dashboard with a more detailed, customizable interface showing repository stats and language distribution.

## How It Works
- **Vanilla Frontend:** Built with pure HTML, CSS, and JavaScript. No build step or heavy dependencies required for the frontend.
- **Automated Data Fetching:** A Node.js script (`scripts/fetch-github-data.js`) uses the GitHub GraphQL API to fetch detailed statistics.
- **GitHub Actions:** A scheduled workflow (`.github/workflows/update-and-deploy.yml`) runs daily. It executes the data fetching script, updates the `data/data.json` file, commits the changes back to the repository, and deploys the site to GitHub Pages.

## Setup & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kosuke-satake/kosuke-satake.github.io.git
   cd kosuke-satake.github.io
   ```

2. **Install dependencies (for the fetch script):**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy `.env.example` to `.env` and add a GitHub Personal Access Token (PAT) with `read:user` and `public_repo` permissions.
   ```bash
   cp .env.example .env
   ```

4. **Fetch Data:**
   Run the Node script to generate your local `data/data.json`.
   ```bash
   npm run fetch-data
   ```

5. **Run Locally:**
   Serve the root directory using any local web server.
   ```bash
   npx serve .
   ```

## GitHub Pages Deployment
This repository is configured to deploy via GitHub Actions. Ensure that in your repository settings:
1. Go to **Settings > Pages**.
2. Set **Source** to **GitHub Actions**.

## Branching & Commit Conventions
This project strictly follows [Conventional Commits](https://www.conventionalcommits.org/).
- Branch naming: `feature/*`, `bugfix/*`, `chore/*`.
- Commits: `type(scope): description` (e.g., `feat(ui): add dark mode`).
