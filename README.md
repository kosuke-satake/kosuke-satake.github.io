# GitHub Dashboard

A zero-maintenance, automated GitHub profile dashboard hosted on GitHub Pages.

## Overview
This repository serves as a dedicated portfolio strictly for GitHub activity. It replaces the standard GitHub dashboard with a more detailed, customizable interface showing repository stats and language distribution.

## How It Works
- **Vanilla Frontend:** Built with pure HTML, CSS, and JavaScript. No build step or heavy dependencies required for the frontend.
- **Automated Data Fetching:** A Node.js script (`scripts/fetch-github-data.js`) uses the GitHub GraphQL API to fetch detailed statistics and writes them to `data/data.json`.
- **GitHub Actions:** A workflow (`.github/workflows/update-and-deploy.yml`) runs daily, on every push to `main`, and on demand. It checks and tests the scripts, fetches the data, commits `data/data.json` (on `main` only), assembles the site into `_site/` with `scripts/build-site.js`, and deploys only that folder to GitHub Pages. Only `index.html`, `css/`, `js/`, and `data/data.json` are published.
- **Bot-authored data commits:** The daily data commit is made by `github-actions[bot]` on purpose. GitHub counts a commit toward a profile's contribution graph only when its author email is linked to that account, so these automated commits do not show up as the owner's contributions. Commits by bots are also left out of the Recent Activity list.

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
   Run the Node script to generate your local `data/data.json`. The workflow commits this file, so do not commit your local copy.
   ```bash
   npm run fetch-data
   ```

5. **Run Locally:**
   Serve the repository root with any local web server for quick edits, or build the site and serve exactly what is published.
   ```bash
   python3 -m http.server              # the source files
   npm run build && python3 -m http.server --directory _site   # the published files
   ```

## GitHub Pages Deployment
This repository is configured to deploy via GitHub Actions. Ensure that in your repository settings:
1. Go to **Settings > Pages**.
2. Set **Source** to **GitHub Actions**.

The workflow uses the built-in `GITHUB_TOKEN`, so it needs no secrets. A run from a branch other than `main` builds the site but does not commit or deploy.

GitHub disables scheduled workflows in a public repository after 60 days without repository activity. If the "Data last updated" line at the bottom of the page gets old, re-enable the workflow in the **Actions** tab or run `gh workflow enable update-and-deploy.yml`.

## Quality Checks
```bash
npm run check   # syntax check of every script
npm test        # unit tests
npm run build   # assemble _site/ and confirm the data file exists
```
Before a change is merged, the built site is also inspected in a browser at phone (375px), tablet (768px) and desktop widths, with the console free of errors.

## Built with AI Assistance
This dashboard was originally generated with Gemini and has since been reworked with Claude Code.

## License
Released under the [MIT License](LICENSE). Third-party notices are in [THIRD_PARTY.md](THIRD_PARTY.md).

## Branching & Commit Conventions
This project strictly follows [Conventional Commits](https://www.conventionalcommits.org/).
- Branch naming: `feat/<topic>`, `fix/<topic>`, or `refactor/<topic>`, in lowercase kebab-case.
- Commits: `type(scope): description` (e.g., `feat(ui): add dark mode`), imperative and concise. Explain why in the body when the change is not trivial.
