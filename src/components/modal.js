import { el, icon, ICONS } from '../lib/dom.js';

let openModals = 0;

export function openModalCount() { return openModals; }

export function openModal({ title, body, footer, size = 'md', onClose }) {
  const root = document.getElementById('modal-root');
  const previousFocus = document.activeElement;

  const close = () => {
    backdrop.remove();
    openModals = Math.max(0, openModals - 1);
    document.body.style.overflow = openModals > 0 ? 'hidden' : '';
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    onClose?.();
  };

  const backdrop = el('div', {
    class: 'modal-backdrop',
    role: 'dialog',
    'aria-modal': 'true',
    onclick: (e) => { if (e.target === backdrop) close(); }
  });

  const modal = el('div', { class: `modal ${size === 'lg' ? 'modal-lg' : ''}` });

  modal.appendChild(
    el('div', { class: 'modal-header' },
      el('h2', {}, title || ''),
      el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon(ICONS.close))
    )
  );

  const bodyEl = el('div', { class: 'modal-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  modal.appendChild(bodyEl);

  if (footer) {
    const footerEl = el('div', { class: 'modal-footer' });
    if (Array.isArray(footer)) footer.forEach((b) => footerEl.appendChild(b));
    else if (footer instanceof Node) footerEl.appendChild(footer);
    modal.appendChild(footerEl);
  }

  backdrop.appendChild(modal);
  root.appendChild(backdrop);
  openModals++;
  document.body.style.overflow = 'hidden';

  const focusable = () => modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable()[0];
  first?.focus();

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key !== 'Tab') return;
    const f = Array.from(focusable()).filter((n) => !n.disabled && n.offsetParent !== null);
    if (f.length === 0) return;
    const firstEl = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
  };
  document.addEventListener('keydown', onKey);

  return { close, bodyEl };
}