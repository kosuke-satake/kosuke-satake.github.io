# Dashboard redesign: proposal

Status: approved by the owner on 2026-11-02 and built on the branch `feat/portfolio-dashboard`: phase 1 (data), the page
and the filter engine of phase 2, and the activity section. The requirement that came with the approval: advanced
filtering, and a page that fixes what people dislike about the plain GitHub profile instead of being a README as a site.
Not built yet: a timeline view of when each project was worked on, screenshots on the featured cards, a Japanese version.

## Goal

In the owner's words: the page exists to make GitHub easy to read. A visitor should see what the owner has done on
GitHub, cleanly and at a glance. A long run of repositories, or numbers that mean nothing, defeats that.

## What is wrong today (measured on the live page, 2026-11-02)

- 5 of the 7 numbers shown are 0 (following, stars, forks, issues, starred).
- 13 repositories are listed flat, and 2 of them appear twice because they are also pinned.
- 6 of 13 repositories have no description, and 9 of 13 have no topic.
- The work of the `kosuke-apps` organization (the released apps) is missing from the list, because the fetch only reads
  repositories owned by the user.
- "Language Analysis" and "Topic Analysis" count repositories, not code, and say little.
- "Recent Activity" is 15 commit messages from mixed projects.
- On a phone the page is about 9,300 px tall, and the profile and two charts come before any work.

## The page

One column, in the order a visitor wants answers:

1. **Hero**: name, a one-sentence tagline written by the owner, links, and four facts that are computed, not typed:
   projects shown, apps released, releases published, commits by the owner in the last 90 days (bots excluded).
2. **Featured**: up to six cards. Each has the name, a one-line summary, a status badge, tags, and the facts that prove
   it (releases, latest version, last activity), with links to the repository and the latest release.
3. **All work, by area**: the hierarchy from the catalog (Apps > iPhone / Mac, Robotics > ROS 2 / Simulation and robots,
   Web). Groups are collapsible. Rows are compact. A status filter and tag chips narrow the list. Hidden projects are
   not shown.
4. **Latest work**: one line per project that changed recently (project, last commit subject, date), replacing the 15
   mixed commits.
5. **Activity and stack**: the contribution calendar, smaller and with month labels, and one stacked bar of languages
   measured in bytes across the listed projects.

Removed: the sidebar, the zero-valued insight cards, the topic chart, the repository-count language chart, the duplicate
"pinned" section.

## Data

`config/catalog.json` is edited by hand. It lists the projects to show (`owner/name`, group path, status, tags, featured,
hidden, optional summary), the group order, and the tagline. The fetch reads each listed repository directly, so
repositories of an organization work, and writes `data/data.json` with the catalog merged in.

- A summary falls back to the GitHub description when the catalog leaves it null.
- Repositories of the user that are not in the catalog appear under "Unsorted" and are reported as a warning in the
  workflow run, so a new repository is never lost and never forgotten.
- A listed repository that cannot be read (private, renamed) is skipped with a warning; the build does not fail.
- Commits by `[bot]` authors stay out of every figure and list.
- Status values: `released`, `in-progress`, `learning`, `paused`, `archived`.

## Phases

Each phase ends with a local preview and a review before anything is pushed.

1. **Data**: the catalog, the fetch that merges it, tests for the merge, the unsorted report and the bot filter.
2. **Page**: hero, featured cards, grouped list, status and tag filters, mobile layout. The old sections go away.
3. **Activity and stack**: latest work, calendar with month labels, language bar, light theme.

Not planned yet: screenshots on the featured cards, a Japanese version.

## Acceptance

- Phone width: the first work card is within the first screen, and the whole page is under 4 screens when groups are
  collapsed.
- Every number on the page is non-zero or omitted, and each can be traced to the API data.
- No horizontal scroll at 375, 768 and 1024 px; contrast of at least 4.5:1; headings in order; filters work with a
  keyboard; `npm run check`, `npm test` and `npm run build` pass; the console is clean.
