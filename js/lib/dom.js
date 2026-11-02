// Build elements with the DOM API so that text from GitHub is never parsed as HTML.
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null && value !== false) node.setAttribute(name, value === true ? '' : value);
  }
  node.append(...children.flat().filter((child) => child !== undefined && child !== null && child !== false));
  return node;
}

// Only http(s) URLs may become links.
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function externalLink(href, content, attrs = {}) {
  const url = safeUrl(href);
  if (!url) return document.createTextNode(typeof content === 'string' ? content : '');
  return h('a', { ...attrs, href: url, target: '_blank', rel: 'noopener noreferrer' }, content);
}
