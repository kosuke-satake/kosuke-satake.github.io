import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STATUSES, parseCatalog, validateCatalog } from '../scripts/lib/catalog.js';

const valid = () => ({
  profile: { tagline: 'Hello', links: [{ label: 'GitHub', url: 'https://github.com/someone' }] },
  groups: ['Apps', 'Apps/iPhone', 'Web'],
  projects: [
    { repo: 'someone/app', group: 'Apps/iPhone', status: 'released', tags: ['swift'], featured: true, summary: null },
    { repo: 'someone/site', group: 'Web', status: 'in-progress' },
    { repo: 'someone/scratch', hidden: true },
  ],
});

const problems = (mutate) => {
  const catalog = valid();
  mutate(catalog);
  return validateCatalog(catalog);
};

test('a well-formed catalog has no problems', () => {
  assert.deepEqual(validateCatalog(valid()), []);
});

test('the real catalog of this repository is valid', () => {
  const text = fs.readFileSync(new URL('../config/catalog.json', import.meta.url), 'utf8');
  assert.doesNotThrow(() => parseCatalog(text));
});

test('every status the page knows is accepted', () => {
  for (const status of STATUSES) {
    assert.deepEqual(problems((c) => { c.projects[1].status = status; }), []);
  }
});

test('an unknown status is reported with the allowed values', () => {
  const [message] = problems((c) => { c.projects[0].status = 'done'; });
  assert.match(message, /someone\/app: "status" must be one of released, in-progress/);
});

test('a group that was not declared is reported', () => {
  const [message] = problems((c) => { c.projects[0].group = 'Apps/Mac'; });
  assert.match(message, /"group" must be one of the declared groups/);
});

test('a group must come after its parent', () => {
  const [message] = problems((c) => { c.groups = ['Apps/iPhone', 'Apps', 'Web']; });
  assert.match(message, /"Apps\/iPhone" must come after its parent "Apps"/);
});

test('a repository listed twice is reported, ignoring case', () => {
  const [message] = problems((c) => { c.projects.push({ repo: 'Someone/App', group: 'Web', status: 'learning' }); });
  assert.match(message, /Someone\/App: listed more than once/);
});

test('a repo name that is not owner/name is reported', () => {
  const [message] = problems((c) => { c.projects[1].repo = 'just-a-name'; });
  assert.match(message, /"repo" must look like "owner\/name"/);
});

test('a hidden project needs only its repo name', () => {
  assert.deepEqual(problems((c) => { c.projects[2] = { repo: 'someone/other', hidden: true }; }), []);
});

test('tags must be non-empty strings', () => {
  const [message] = problems((c) => { c.projects[0].tags = ['ok', '']; });
  assert.match(message, /"tags" must be an array of non-empty strings/);
});

test('profile links must be https', () => {
  const [message] = problems((c) => { c.profile.links[0].url = 'http://example.com'; });
  assert.match(message, /profile\.links\[0\]/);
});

test('parseCatalog explains invalid JSON and lists every problem', () => {
  assert.throws(() => parseCatalog('{ nope'), /not valid JSON/);
  const catalog = valid();
  catalog.projects[0].status = 'nope';
  catalog.projects[1].group = 'Nowhere';
  assert.throws(() => parseCatalog(JSON.stringify(catalog)), (error) => {
    assert.match(error.message, /config\/catalog\.json is invalid/);
    assert.equal(error.message.split('\n').filter((line) => line.startsWith('  - ')).length, 2);
    return true;
  });
});
