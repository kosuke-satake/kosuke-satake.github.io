import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCatalog } from './lib/catalog.js';
import { buildData, buildRequest } from './lib/build-data.js';

// Load environment variables for local development
try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (e) {
  // Ignore missing dotenv in production/GitHub Actions
}

const LOGIN = 'kosuke-satake';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'catalog.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'data.json');

// A catalog entry that GitHub cannot find comes back as a NOT_FOUND error on its alias (p0, p1, ...) next to the
// rest of the data. Those are reported as warnings later; every other error is fatal.
export function fatalErrors(errors = []) {
  return errors.filter((error) => !(error.type === 'NOT_FOUND' && /^p\d+$/.test(error.path?.[0] ?? '')));
}

function parseArguments(argv) {
  const options = { printRequest: false, fromFile: null };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--print-request') options.printRequest = true;
    else if (argv[index] === '--from-file') options.fromFile = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return options;
}

async function requestFromGitHub(request, token) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000), // fail instead of hanging until the job's own timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GitHub API error: ${response.status} ${response.statusText}`, errorText);
    process.exit(1);
  }
  return response.json();
}

function reportWarnings(warnings) {
  for (const warning of warnings) {
    // In GitHub Actions this becomes an annotation on the run; elsewhere it is a plain line.
    console.warn(process.env.GITHUB_ACTIONS ? `::warning title=Dashboard catalog::${warning}` : `Warning: ${warning}`);
  }
}

async function fetchGitHubData() {
  const options = parseArguments(process.argv.slice(2));
  const catalog = parseCatalog(await fs.readFile(CATALOG_PATH, 'utf8'));
  const request = buildRequest(catalog, LOGIN);

  if (options.printRequest) {
    console.log(JSON.stringify(request));
    return;
  }

  let result;
  if (options.fromFile) {
    result = JSON.parse(await fs.readFile(options.fromFile, 'utf8'));
  } else {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('Error: GITHUB_TOKEN environment variable is not set.');
      process.exit(1);
    }
    console.log('Fetching GitHub data...');
    result = await requestFromGitHub(request, token);
  }

  const fatal = fatalErrors(result.errors);
  if (fatal.length > 0) {
    console.error('GraphQL Errors:', JSON.stringify(fatal, null, 2));
    process.exit(1);
  }

  const { data, warnings } = buildData({ response: result, catalog, login: LOGIN });
  reportWarnings(warnings);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(data, null, 1));
  console.log(`Wrote data/data.json: ${data.projects.length} projects, ${warnings.length} warning(s).`);
}

// Run only when executed as a script, so that tests can import the helpers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchGitHubData().catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
