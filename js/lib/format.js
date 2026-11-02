const DAY = 86_400_000;

export const formatCount = (value) => new Intl.NumberFormat('en').format(value);

export const formatDate = (iso) => new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });

export const plural = (count, word) => `${formatCount(count)} ${word}${count === 1 ? '' : 's'}`;

// "today", "yesterday", "12 days ago", "3 months ago", "2 years ago".
export function relativeTime(iso, now = new Date()) {
  const days = Math.floor((now - new Date(iso)) / DAY);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return plural(Math.floor(days / 30.44), 'month') + ' ago';
  return plural(Math.floor(days / 365.25), 'year') + ' ago';
}
