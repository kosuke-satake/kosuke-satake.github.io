# Third-party software

| Component | Version | License | Use |
|---|---|---|---|
| [dotenv](https://github.com/motdotla/dotenv) | 17.4.2 | BSD-2-Clause | Development only. Loads `.env` when `scripts/fetch-github-data.js` runs on a developer machine. It is not part of the published site. |

The GitHub Actions used by the workflow (`actions/checkout`, `actions/setup-node`, `actions/configure-pages`,
`actions/upload-pages-artifact`, `actions/deploy-pages`) are MIT licensed and run only on GitHub's runners. None of
their code is part of the site.

The site displays public data about the `kosuke-satake` account, fetched from the GitHub GraphQL API.
