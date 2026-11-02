// The page state that belongs in the address bar, so a filtered view can be shared or bookmarked.
export const DEFAULT_STATE = { q: '', sort: 'area', view: 'list' };

const SORTS = ['area', 'active', 'name', 'created', 'releases', 'commits'];
const VIEWS = ['list', 'grid'];

export function stateFromSearch(search) {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  const view = params.get('view');
  return {
    q: (params.get('q') ?? '').slice(0, 300),
    sort: SORTS.includes(sort) ? sort : DEFAULT_STATE.sort,
    view: VIEWS.includes(view) ? view : DEFAULT_STATE.view,
  };
}

// Values that equal the default are left out, so the plain page keeps a plain address.
export function searchFromState(state) {
  const params = new URLSearchParams();
  if (state.q.trim() !== '') params.set('q', state.q.trim());
  if (state.sort !== DEFAULT_STATE.sort) params.set('sort', state.sort);
  if (state.view !== DEFAULT_STATE.view) params.set('view', state.view);
  const text = params.toString();
  return text ? `?${text}` : '';
}
