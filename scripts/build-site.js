import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Assemble the files that GitHub Pages serves into _site/.
// Only the entries below are published; scripts, package files, and the README stay in the repository.
const PUBLISHED = ['index.html', 'css', 'js', 'data/data.json'];

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '_site');

for (const entry of PUBLISHED) {
  try {
    await fs.access(path.join(root, entry));
  } catch {
    console.error(`Missing ${entry}. Run "npm run fetch-data" first.`);
    process.exit(1);
  }
}

await fs.rm(outDir, { recursive: true, force: true });

for (const entry of PUBLISHED) {
  const target = path.join(outDir, entry);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(path.join(root, entry), target, { recursive: true });
}

console.log(`Built ${PUBLISHED.join(', ')} into _site/.`);
