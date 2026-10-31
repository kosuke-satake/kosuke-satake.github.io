# kosuke-satake.github.io

GitHub activity dashboard for the `kosuke-satake` account, hosted on GitHub Pages and rebuilt every day by GitHub
Actions. Workspace rules are in `~/Developer/AGENTS.md` and the website program rules in
`~/Developer/Projects/Website/AGENTS.md`; this file adds what is specific to this project.

## Product

- Purpose: show the owner's public GitHub work (repositories, languages, topics, contribution history, recent commits)
  on one page that links to the real repositories.
- Intended users: people evaluating the owner's work, such as employers and collaborators.
- Core user journey: open the page, see who the owner is and what they build, follow a link to a repository.
- Out of scope: private repositories and data, per-visitor features, a backend, a build step for the frontend.

## Technical context

- Stack: vanilla HTML, CSS and ES modules in the browser; Node.js 22+ scripts; GitHub Actions; GitHub Pages. The only
  dependency is `dotenv` (development only).
- Architecture (file by file):
  - `index.html`: page skeleton with placeholders that `js/main.js` fills in.
  - `css/style.css`: all styles. Design tokens are custom properties in `:root`. Dark theme only.
  - `js/main.js`: loads `data/data.json` and renders it with the DOM API. Never use `innerHTML` for GitHub text.
  - `scripts/fetch-github-data.js`: queries the GitHub GraphQL API and writes `data/data.json`. Commits by `[bot]`
    authors are left out of Recent Activity.
  - `scripts/build-site.js`: copies the allow-listed site files into `_site/`.
  - `tests/fetch-github-data.test.js`: unit tests for the helpers of the fetch script (`node --test`).
  - `.github/workflows/update-and-deploy.yml`: a build job (check, test, fetch, commit the data, assemble, upload) and a
    deploy job.
- Constraints:
  - The workflow commits `data/data.json` every day as `github-actions[bot]`. Never change that identity to the
    owner's. A commit counts toward a profile's contribution graph only when its author email is linked to that
    account, and daily data commits under the owner's name once made up more than a fifth of the graph. Do not commit
    `data/data.json` by hand either.
  - The commit step runs on `main` only. A run from another branch builds the site but neither commits nor deploys,
    because the `github-pages` environment accepts deployments from `main` only.
  - `_site/` is generated and git-ignored. Only `index.html`, `css/`, `js/` and `data/data.json` are published; add any
    new public file to `PUBLISHED` in `scripts/build-site.js`.
  - GitHub disables scheduled workflows in a public repository after 60 days without repository activity. The daily
    bot commit is expected to keep the repository active, but this is not confirmed. If the "Data last updated" line
    goes stale, re-enable the workflow with `gh workflow enable`.
  - The fetch lists the user's own non-fork repositories. Repositories owned by an organization (for example
    `kosuke-apps`) are not included.

## Commands

- Install: `npm install` (CI uses `npm ci`)
- Develop: `npm run fetch-data` (needs `GITHUB_TOKEN` in `.env`, see `.env.example`), then `python3 -m http.server`.
  Do not commit the `data/data.json` that this changes.
- Format: none configured
- Lint: none configured
- Type-check: none configured
- Test: `npm test` (unit tests) and `npm run check` (syntax check of every script)
- Build: `npm run build`, then `python3 -m http.server --directory _site` to see exactly what is published

## Definition of done

- The requested behaviour is complete, including loading, empty and error states.
- `npm run check`, `npm test` and `npm run build` pass.
- The built site is inspected at 375, 768 and 1024 px: no horizontal scroll, no console errors.
- Text contrast is at least 4.5:1, headings do not skip levels, and interactive elements work with a keyboard.
- README and this file match what was delivered.
