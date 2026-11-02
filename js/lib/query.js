// The search box language: free words plus qualifiers such as `status:released lang:swift -tag:template`.
// The query string is the single source of truth: typing edits it, the filter panel rewrites it.

export const QUALIFIERS = ['status', 'lang', 'tag', 'area', 'active', 'has', 'is', 'license'];

const TOKEN = /(-?)(?:([a-z]+):)?(?:"([^"]*)"|(\S+))/gi;

// A qualifier word we do not know (for example "http:") is searched as plain text.
export function parseQuery(input) {
  const terms = [];
  const filters = [];
  for (const match of String(input ?? '').matchAll(TOKEN)) {
    const negated = match[1] === '-';
    const key = match[2]?.toLowerCase();
    const value = match[3] ?? match[4];
    if (key && QUALIFIERS.includes(key)) {
      if (value !== '') filters.push({ key, value, negated });
    } else if (key) {
      terms.push({ value: `${match[2]}:${value}`, negated });
    } else if (value !== '' && value !== '-') {
      // "status:" typed so far, with no value yet, is an unfinished filter and is ignored.
      const unfinished = /^([a-z]+):$/i.exec(value);
      if (unfinished && QUALIFIERS.includes(unfinished[1].toLowerCase())) continue;
      terms.push({ value, negated });
    }
  }
  return { terms, filters };
}

const quote = (value) => (/\s/.test(value) ? `"${value.replaceAll('"', '')}"` : value);
const sign = (negated) => (negated ? '-' : '');

// Filters first, then the free words.
export function serializeQuery({ terms, filters }) {
  return [
    ...filters.map((filter) => `${sign(filter.negated)}${filter.key}:${quote(filter.value)}`),
    ...terms.map((term) => `${sign(term.negated)}${quote(term.value)}`),
  ].join(' ');
}

const same = (a, b) => a.key === b.key && a.value.toLowerCase() === b.value.toLowerCase() && a.negated === b.negated;

export function hasFilter(parsed, key, value, negated = false) {
  return parsed.filters.some((filter) => same(filter, { key, value, negated }));
}

// Adds the filter, or removes it if it is already there. An opposite filter on the same value is replaced.
export function toggleFilter(input, key, value, negated = false) {
  const parsed = parseQuery(input);
  const wanted = { key, value, negated };
  if (parsed.filters.some((filter) => same(filter, wanted))) {
    parsed.filters = parsed.filters.filter((filter) => !same(filter, wanted));
  } else {
    parsed.filters = parsed.filters.filter((filter) => !same(filter, { key, value, negated: !negated }));
    parsed.filters.push(wanted);
  }
  return serializeQuery(parsed);
}

// Replaces every filter of one key by a single value, or clears the key when the value is null.
export function setFilter(input, key, value) {
  const parsed = parseQuery(input);
  parsed.filters = parsed.filters.filter((filter) => filter.key !== key);
  if (value !== null) parsed.filters.push({ key, value, negated: false });
  return serializeQuery(parsed);
}

export function removeFilter(input, filter) {
  const parsed = parseQuery(input);
  parsed.filters = parsed.filters.filter((item) => !same(item, filter));
  return serializeQuery(parsed);
}

export function removeTerm(input, index) {
  const parsed = parseQuery(input);
  parsed.terms = parsed.terms.filter((_, position) => position !== index);
  return serializeQuery(parsed);
}
