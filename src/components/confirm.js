import { openModal } from './modal.js';
import { el } from '../lib/dom.js';

export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = true }) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (val) => { if (resolved) return; resolved = true; resolve(val); };

    const cancel = el('button', { class: 'btn btn-secondary', onclick: () => { done(false); api.close(); } }, 'Cancel');
    const confirm = el('button', {
      class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
      onclick: () => { done(true); api.close(); }
    }, confirmText);

    const body = el('div', {}, el('p', { style: { color: 'var(--text-secondary)' } }, message));

    const api = openModal({
      title,
      body,
      footer: [cancel, confirm],
      onClose: () => done(false)
    });
    confirm.focus();
  });
}