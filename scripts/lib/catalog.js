// The hand-maintained list of projects shown on the dashboard (config/catalog.json).

export const STATUSES = ['released', 'in-progress', 'learning', 'paused', 'archived'];

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Returns a list of human-readable problems. An empty list means the catalog is valid.
export function validateCatalog(catalog) {
  if (!isObject(catalog)) return ['The catalog must be a JSON object.'];
  const errors = [];

  const profile = catalog.profile ?? {};
  if (!isObject(profile)) {
    errors.push('"profile" must be an object.');
  } else {
    for (const field of ['name', 'tagline']) {
      if (profile[field] !== undefined && typeof profile[field] !== 'string') {
        errors.push(`"profile.${field}" must be a string.`);
      }
    }
    (profile.links ?? []).forEach((link, index) => {
      if (!isObject(link) || typeof link.label !== 'string' || !/^https:\/\//.test(link.url ?? '')) {
        errors.push(`"profile.links[${index}]" needs a "label" and an https "url".`);
      }
    });
  }

  const known = new Set();
  if (!Array.isArray(catalog.groups) || catalog.groups.length === 0) {
    errors.push('"groups" must be a non-empty array of paths such as "Apps/iPhone".');
  } else {
    for (const group of catalog.groups) {
      if (typeof group !== 'string' || group.split('/').some((segment) => !segment.trim())) {
        errors.push(`Invalid group path: ${JSON.stringify(group)}.`);
        continue;
      }
      if (known.has(group)) errors.push(`Group "${group}" is declared twice.`);
      const parent = group.split('/').slice(0, -1).join('/');
      if (parent && !known.has(parent)) errors.push(`Group "${group}" must come after its parent "${parent}".`);
      known.add(group);
    }
  }

  if (!Array.isArray(catalog.projects)) {
    errors.push('"projects" must be an array.');
    return errors;
  }

  const seen = new Set();
  catalog.projects.forEach((project, index) => {
    if (!isObject(project) || typeof project.repo !== 'string' || !REPO_PATTERN.test(project.repo)) {
      errors.push(`projects[${index}]: "repo" must look like "owner/name".`);
      return;
    }
    const label = project.repo;
    const key = label.toLowerCase();
    if (seen.has(key)) errors.push(`${label}: listed more than once.`);
    seen.add(key);

    for (const flag of ['featured', 'hidden']) {
      if (project[flag] !== undefined && typeof project[flag] !== 'boolean') {
        errors.push(`${label}: "${flag}" must be true or false.`);
      }
    }
    if (project.summary !== undefined && project.summary !== null && typeof project.summary !== 'string') {
      errors.push(`${label}: "summary" must be a string or null.`);
    }
    if (project.hidden === true) return; // a hidden project only needs its repo name

    if (!known.has(project.group)) {
      errors.push(`${label}: "group" must be one of the declared groups (got ${JSON.stringify(project.group)}).`);
    }
    if (!STATUSES.includes(project.status)) {
      errors.push(`${label}: "status" must be one of ${STATUSES.join(', ')} (got ${JSON.stringify(project.status)}).`);
    }
    if (project.tags !== undefined && (!Array.isArray(project.tags) || project.tags.some((tag) => typeof tag !== 'string' || !tag.trim()))) {
      errors.push(`${label}: "tags" must be an array of non-empty strings.`);
    }
  });

  return errors;
}

export function parseCatalog(text) {
  let catalog;
  try {
    catalog = JSON.parse(text);
  } catch (error) {
    throw new Error(`config/catalog.json is not valid JSON: ${error.message}`);
  }
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`config/catalog.json is invalid:\n${errors.map((message) => `  - ${message}`).join('\n')}`);
  }
  return catalog;
}
