import { el, icon } from '../lib/dom.js';

export function emptyState({ iconPath, title, description, action }) {
  const node = el('div', { class: 'empty' });
  if (iconPath) node.appendChild(el('div', { class: 'empty-icon' }, icon(iconPath, 48)));
  node.appendChild(el('h3', {}, title));
  if (description) node.appendChild(el('p', {}, description));
  if (action) node.appendChild(action);
  return node;
}