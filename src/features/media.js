import { el, icon, ICONS, escapeHtml } from '../lib/dom.js';
import { STORAGE_KEYS } from '../lib/constants.js';
import { store } from '../lib/storage.js';
import { toast } from '../lib/toast.js';
import { emptyState } from '../components/empty.js';
import { confirmDialog } from '../components/confirm.js';
import { rerender } from '../router.js';

export function renderMedia(main) {
  const saved = store.get(STORAGE_KEYS.pdf);

  main.appendChild(el('div', { class: 'page-header' },
    el('div', {},
      el('h1', {}, 'Media'),
      el('p', { class: 'subtitle' }, 'Upload a PDF to present alongside your songs.')
    )
  ));

  if (!saved || !saved.data) {
    const input = el('input', {
      type: 'file',
      accept: '.pdf',
      style: { display: 'none' },
      onchange: (e) => {
        handleUpload(e.target.files?.[0]);
        input.remove();
      }
    });
    main.appendChild(emptyState({
      iconPath: ICONS.media,
      title: 'No PDF loaded',
      description: 'Upload a PDF file to present it on the live screen.',
      action: el('div', { style: { display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' } },
        el('button', {
          class: 'btn btn-primary',
          onclick: () => { document.body.appendChild(input); input.click(); }
        }, icon(ICONS.upload), 'Upload PDF')
      )
    }));
    return;
  }

  const card = el('div', { class: 'card' },
    el('div', { class: 'card-header' },
      el('div', {},
        el('div', { class: 'card-title' }, saved.name),
        el('div', { class: 'card-subtitle' }, 'Ready to present')
      ),
      el('span', { class: 'badge badge-success' }, 'Loaded')
    ),
    el('div', { style: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' } },
      el('button', { class: 'btn btn-primary', onclick: () => presentPDF(saved) }, icon(ICONS.monitor), 'Present PDF'),
      el('button', { class: 'btn btn-secondary', onclick: () => replacePDF() }, icon(ICONS.upload), 'Replace'),
      el('button', { class: 'btn btn-ghost', onclick: () => removePDF() }, icon(ICONS.trash), 'Remove')
    )
  );
  main.appendChild(card);

  function replacePDF() {
    const input = el('input', {
      type: 'file',
      accept: '.pdf',
      style: { display: 'none' },
      onchange: (e) => {
        handleUpload(e.target.files?.[0]);
        input.remove();
      }
    });
    document.body.appendChild(input);
    input.click();
  }

  async function removePDF() {
    const ok = await confirmDialog({ title: 'Remove PDF?', message: 'The uploaded PDF will be cleared from this device.', confirmText: 'Remove' });
    if (!ok) return;
    store.remove(STORAGE_KEYS.pdf);
    toast('PDF removed', 'info');
    rerender();
  }
}

function handleUpload(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') { toast('Please select a PDF file', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    store.set(STORAGE_KEYS.pdf, { name: file.name, data: e.target.result });
    toast('PDF loaded', 'success');
    rerender();
  };
  reader.readAsDataURL(file);
}

function presentPDF(saved) {
  const w = 1100, h = 700;
  const left = (screen.width - w) / 2;
  const top = (screen.height - h) / 2;
  const win = window.open('', 'JFCM_PDF', `width=${w},height=${h},left=${left},top=${top},resizable=yes`);
  const safeName = escapeHtml(saved.name);
  const base64 = saved.data.split(',')[1] || saved.data;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; }
  canvas { max-width: 100vw; max-height: 100vh; display: block; }
  .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; background: rgba(0,0,0,0.7); padding: 8px 14px; border-radius: 10px; opacity: 0; transition: opacity 0.2s; }
  .controls:hover { opacity: 1; }
  .controls button { background: #c9a227; color: #0f0f0f; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .controls span { color: #eee; font-size: 13px; }
  .controls input { width: 48px; text-align: center; background: #222; border: 1px solid #444; color: #fff; border-radius: 4px; padding: 4px; }
</style></head><body>
<div id="viewer"></div>
<div class="controls">
  <button onclick="prev()">◀</button>
  <span>Page <input type="number" id="pageInput" value="1" min="1"> / <span id="total">?</span></span>
  <button onclick="next()">▶</button>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
<script>
  const b64 = '${base64}';
  let doc, current = 1, total = 0;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  async function load() {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    total = doc.numPages;
    document.getElementById('total').textContent = total;
    document.getElementById('pageInput').max = total;
    render(1);
  }
  async function render(n) {
    if (!doc || n < 1 || n > total) return;
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    document.getElementById('viewer').innerHTML = '';
    document.getElementById('viewer').appendChild(canvas);
    current = n;
    document.getElementById('pageInput').value = n;
  }
  window.next = () => render(current + 1);
  window.prev = () => render(current - 1);
  document.getElementById('pageInput').addEventListener('change', (e) => render(parseInt(e.target.value, 10)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });
  load();
<\/script></body></html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  toast('PDF presentation opened', 'success');
}