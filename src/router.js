import { getState, subscribe } from './state/store.js';

const routes = new Map();
let current = 'dashboard';
let renderFn = null;

export function registerRoute(id, render) {
  routes.set(id, render);
}

export function navigate(id) {
  if (!routes.has(id)) id = 'dashboard';
  current = id;
  history.replaceState({ route: id }, '', `#${id}`);
  rerender();
}

export function getCurrentRoute() { return current; }

export function mountRouter(el, renderShellFn) {
  renderFn = renderShellFn;
  window.addEventListener('hashchange', () => {
    const hash = location.hash.slice(1);
    if (hash && routes.has(hash)) { current = hash; rerender(); }
  });
  const initial = location.hash.slice(1);
  if (initial && routes.has(initial)) current = initial;
  rerender();
}

let shellInstance = null;

export function rerender() {
  shellInstance?.destroy?.();
  const { main, destroy } = renderFn(current);
  shellInstance = { destroy };
  const page = routes.get(current);
  if (page) page(main);
}