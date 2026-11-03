# GitHub Dashboard

A searchable dashboard of what I have built on GitHub, hosted on GitHub Pages and rebuilt every day.

## Overview
A plain GitHub profile lists repositories flat and says little about them. This page groups the work by area (apps,
robotics, web), and each project shows what it is, its status, its latest release and how active it is. The list can be
searched and filtered by area, status, language, tag, recent activity, release and license, and the filtered view has
its own address so it can be shared.

The projects, their areas, statuses and tags are listed by hand in `config/catalog.json`; the numbers come from the
GitHub API. Repositories of the `kosuke-apps` organization are included.

## Charts and numbers
Below the project list: the contribution calendar with the longest streak and the busiest month; a timeline with a
row per project and a column per week (darker means more commits, a diamond is a release); commits per week by area;
releases per month; the latest releases; languages by code size; the status split; the most used tags (select one to
filter the list); and a table that sums each area up. Commits by bots are never counted.

## Searching and filtering
Type words, or qualifiers, in the search box, or click the filters; they edit the same query.

| Query | Meaning |
|---|---|
| `status:released` | released, in-progress, learning, paused or archived |
| `lang:swift` | the main language, or one that is at least 10% of the code |
| `tag:ios` | a tag from the catalog or a GitHub topic |
| `area:apps` | an area, a sub-area, or a path such as `Apps/iPhone` |
| `active:30d` | active within 7d, 30d, 90d or 1y (also `2w`, `6m`) |
| `has:release`, `is:featured`, `is:stale` | has a release; featured; idle for 180 days |
| `license:mit` | a license identifier |
| `-tag:template` | a leading minus excludes |

Several values of one qualifier mean "or", different qualifiers mean "and". Press `/` to jump to the search box.
The buttons under the search box are one-click views (released, active in 30 days, in progress and learning,
featured), and the "Recent work" list above shows the newest commits by a person, at most two per project; merge
commits and bot commits are left out.

## How It Works
- **Vanilla Frontend:** Built with pure HTML, CSS, and JavaScript. No build step or heavy dependencies required for the frontend.
- **Automated Data Fetching:** A Node.js script (`scripts/fetch-github-data.js`) reads `config/catalog.json`, asks the GitHub GraphQL API for each listed project (languages, releases, recent commits, commits per week) and writes `data/data.json`. A public repository of mine that is missing from the catalog is reported as a warning in the workflow run, so a new project is never forgotten.
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
   Without a token you can use the GitHub CLI instead:
   ```bash
   node scripts/fetch-github-data.js --print-request > request.json
   gh api graphql --input request.json > response.json
   node scripts/fetch-github-data.js --from-file response.json
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

## Editing the project list
Edit `config/catalog.json`: add an entry for a new project (`owner/name`, an area from `groups`, a status, tags), set
`featured` for the cards at the top, or `hidden` to keep a repository off the page. `npm run check` validates the file
and explains every mistake.

## Quality Checks
```bash
npm run check   # syntax check of every script, and validation of the catalog
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
