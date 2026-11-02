# kosuke-satake.github.io

A searchable dashboard of the work of the `kosuke-satake` account and the `kosuke-apps` organization, hosted on GitHub
Pages and rebuilt every day by GitHub Actions. Workspace rules are in `~/Developer/AGENTS.md` and the website program rules in
`~/Developer/Projects/Website/AGENTS.md`; this file adds what is specific to this project.

## Product

- Purpose: summarize what the owner has done on GitHub so that it is easy to read, instead of a flat list of
  repositories and numbers that mean nothing. Work is grouped by area, each project says what it is, its status, its
  latest release and how active it is, and the whole list can be searched and filtered.
- Intended users: people evaluating the owner's work, such as employers and collaborators.
- Core user journey: open the page, see who the owner is and what they build, narrow the list (by area, status,
  language, tag, recent activity) or type a query such as `status:released lang:swift`, follow a link to a repository.
- Out of scope: private repositories and data, per-visitor accounts, a backend, a build step for the frontend.

## Technical context

- Stack: vanilla HTML, CSS and ES modules in the browser; Node.js 22+ scripts; GitHub Actions; GitHub Pages. The only
  dependency is `dotenv` (development only).
- Architecture (file by file):
  - `config/catalog.json`: the hand-maintained list of projects to show (any `owner/name`), their area as a path such as
    `Apps/iPhone`, status, tags, featured or hidden, an optional summary, and the owner's name and tagline. The owner
    edits this file by hand.
  - `scripts/lib/catalog.js`: validates the catalog and explains every problem.
  - `scripts/lib/build-data.js`: pure code that builds the GraphQL request and turns the API response plus the catalog
    into the page data (schema 2). Bot commits are left out of every list and date.
  - `scripts/fetch-github-data.js`: sends the request and writes `data/data.json`. `--print-request` prints the query and
    `--from-file <response.json>` builds the data from a saved response, both without a token.
  - `scripts/build-site.js`, `scripts/check.js`: assemble the published files; syntax-check every script and the catalog.
  - `index.html`, `css/style.css`: the page skeleton and all styles (dark and light, from design tokens in `:root`).
  - `js/main.js`: loads the data and wires the page. `js/ui/*`: hero, project card, search and filter panel, results,
    activity. `js/lib/*`: the query language (`query.js`), matching, facet counts and sorting (`filter.js`), the
    address-bar state, formatting, and DOM helpers. Never use `innerHTML` for GitHub text.
  - `tests/`: unit tests (`node --test`) for the catalog, the data builder, the query language, the filter engine and
    the URL state.
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
  - Only projects listed in `config/catalog.json` are shown, from any account or organization. A public repository of
    the user that is missing from the catalog is reported as a warning in the workflow run, so none is forgotten. A
    private or missing repository is skipped with a warning. Hidden entries are never written to `data/data.json`.
  - Keep the search state in one string (the query) so that typing, the filter panel and the address bar agree.

## Commands

- Install: `npm install` (CI uses `npm ci`)
- Develop: `npm run fetch-data` (needs `GITHUB_TOKEN` in `.env`, see `.env.example`), then `python3 -m http.server`.
  Without a token: `node scripts/fetch-github-data.js --print-request > request.json`, then
  `gh api graphql --input request.json > response.json`, then `node scripts/fetch-github-data.js --from-file response.json`.
  Do not commit the `data/data.json` that this changes.
- Format: none configured
- Lint: none configured
- Type-check: none configured
- Test: `npm test` (unit tests) and `npm run check` (syntax check of every script)
- Build: `npm run build`, then `python3 -m http.server --directory _site` to see exactly what is published

## Definition of done

- The requested behaviour is complete, including loading, empty and error states.
- `npm run check`, `npm test` and `npm run build` pass.
- The built site is inspected at 375, 768 and 1024 px, in the dark and the light theme: no horizontal scroll, no
  console errors, and the search, the filters and the sort work.
- Text contrast is at least 4.5:1, headings do not skip levels, and interactive elements work with a keyboard.
- README and this file match what was delivered.
