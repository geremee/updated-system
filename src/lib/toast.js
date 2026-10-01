import { el } from './dom.js';

const region = () => document.getElementById('toast-region');
const MAX = 4;

export function toast(message, type = 'info', duration = 3200) {
  const r = region();
  if (!r) return;
  while (r.children.length >= MAX) r.removeChild(r.firstChild);

  const node = el('div', { class: `toast ${type}`, role: 'status' }, message);
  r.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity 200ms, transform 200ms';
    node.style.opacity = '0';
    node.style.transform = 'translateX(16px)';
    setTimeout(() => node.remove(), 220);
  }, duration);
}

export function setLoading(show, text = 'Loading…') {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.toggle('hidden', !show);
  overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
  const p = overlay.querySelector('p');
  if (p && show) p.textContent = text;
}