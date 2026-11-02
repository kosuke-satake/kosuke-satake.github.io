import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCatalog } from './lib/catalog.js';

// Syntax-checks every script and validates the catalog, so a mistake fails fast in the workflow.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function listScripts(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return listScripts(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

let failures = 0;
const files = ['js', 'scripts', 'tests'].flatMap((name) => listScripts(path.join(root, name)));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures++;
    console.error(`Syntax error in ${path.relative(root, file)}:\n${result.stderr}`);
  }
}

try {
  parseCatalog(fs.readFileSync(path.join(root, 'config', 'catalog.json'), 'utf8'));
} catch (error) {
  failures++;
  console.error(error.message);
}

if (failures > 0) process.exit(1);
console.log(`Checked ${files.length} scripts and config/catalog.json.`);
