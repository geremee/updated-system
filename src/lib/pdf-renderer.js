// src/lib/pdf-renderer.js
// Loads PDF.js lazily, renders pages at correct DPI, caches rendered canvases.

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let pdfjsPromise = null;

export function loadPdfJs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      return resolve(window.pdfjsLib);
    }
    const s = document.createElement('script');
    s.src = `${PDFJS_BASE}/pdf.min.js`;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

/** Open a PDF from ArrayBuffer / Blob / Uint8Array. Returns a pdf.js document proxy. */
export async function openPdf(source) {
  const pdfjs = await loadPdfJs();
  let data = source;
  if (source instanceof Blob) data = new Uint8Array(await source.arrayBuffer());
  else if (source instanceof ArrayBuffer) data = new Uint8Array(source);
  return pdfjs.getDocument({ data }).promise;
}

/**
 * Render a page to a canvas.
 * @param {object} opts
 * @param {object} opts.page      pdf.js page proxy
 * @param {HTMLCanvasElement} opts.canvas
 * @param {number} opts.containerWidth
 * @param {number} opts.containerHeight
 * @param {'fit-width'|'fit-height'|'fit-page'|'actual'} opts.fit
 * @param {number} [opts.zoom]    multiplier when fit === 'actual'
 * @returns {Promise<{cssWidth:number, cssHeight:number}>}
 */
export async function renderPage({ page, canvas, containerWidth, containerHeight, fit = 'fit-page', zoom = 1 }) {
  const dpr = window.devicePixelRatio || 1;
  const base = page.getViewport({ scale: 1 });

  let scale;
  if (fit === 'fit-width') scale = containerWidth / base.width;
  else if (fit === 'fit-height') scale = containerHeight / base.height;
  else if (fit === 'fit-page') scale = Math.min(containerWidth / base.width, containerHeight / base.height);
  else scale = zoom; // 'actual'

  const viewport = page.getViewport({ scale: scale * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return { cssWidth: viewport.width / dpr, cssHeight: viewport.height / dpr };
}

/** Render a small thumbnail (used in the media library and deck view). */
export async function renderThumbnail(page, maxWidth = 180) {
  const base = page.getViewport({ scale: 1 });
  const scale = maxWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.7);
}