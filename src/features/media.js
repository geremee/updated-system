// src/features/media.js
import { el, icon, ICONS, debounce } from '../lib/dom.js';
import { toast, setLoading } from '../lib/toast.js';
import { confirmDialog } from '../components/confirm.js';
import { emptyState } from '../components/empty.js';
import { openModal } from '../components/modal.js';
import { rerender } from '../router.js';
import {
  savePdf, getPdf, listPdfs, deletePdf, renamePdf,
  saveDeck, listDecks, getDeck, deleteDeck
} from '../lib/pdf-store.js';
import { openPdf, renderThumbnail } from '../lib/pdf-renderer.js';
import { sendMessage } from '../lib/present-bus.js';

const LAST_DECK_KEY = 'jfcm.lastDeckId';

/* ============================================================
   Public entry
   ============================================================ */

export async function renderMedia(main) {
  main.appendChild(el('div', { class: 'page-header' },
    el('div', {},
      el('h1', {}, 'Media'),
      el('p', { class: 'subtitle' }, 'Upload PDFs, build service decks, and present them live.')
    ),
    el('div', { class: 'page-header-actions' },
      el('button', { class: 'btn btn-secondary', onclick: () => openUploadDialog() },
        icon(ICONS.upload), 'Upload PDF'),
      el('button', { class: 'btn btn-primary', onclick: () => openDeckEditor() },
        icon(ICONS.setlist), 'Build Deck')
    )
  ));

  // Two columns: library on the left, decks on the right
  const grid = el('div', { class: 'grid grid-2', style: { alignItems: 'start' } });
  main.appendChild(grid);

  const libraryCol = el('div', {});
  const deckCol = el('div', {});
  grid.appendChild(libraryCol);
  grid.appendChild(deckCol);

  await renderLibrary(libraryCol);
  await renderDecks(deckCol);

  // Listen for updates from the presenter window (e.g. page changed)
  const off = onMessage?.((msg) => {
    if (msg?.type === 'deck:changed') renderDecks(deckCol);
  });
  // No cleanup hook in this router — that's fine, the handler is idempotent
}

/* ============================================================
   Library
   ============================================================ */

async function renderLibrary(root) {
  root.innerHTML = '';
  const pdfs = await listPdfs();

  root.appendChild(el('div', { class: 'card-header' },
    el('div', {},
      el('div', { class: 'card-title' }, 'PDF Library'),
      el('div', { class: 'card-subtitle' }, `${pdfs.length} file${pdfs.length === 1 ? '' : 's'}`)
    )
  ));

  if (!pdfs.length) {
    root.appendChild(emptyState({
      iconPath: ICONS.media,
      title: 'No PDFs yet',
      description: 'Upload a PDF to use it in a service deck.',
      action: el('button', { class: 'btn btn-primary', onclick: () => openUploadDialog() },
        icon(ICONS.upload), 'Upload PDF')
    }));
    return;
  }

  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } });
  root.appendChild(list);

  for (const pdf of pdfs) {
    list.appendChild(await renderPdfRow(pdf));
  }
}

async function renderPdfRow(pdf) {
  const row = el('div', { class: 'pdf-row', style: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    padding: 'var(--space-3)', background: 'var(--bg-raised)',
    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'
  }});

  // Thumbnail
  const thumbBox = el('div', {
    style: {
      width: '64px', height: '84px', flexShrink: '0',
      background: '#000', borderRadius: 'var(--radius-sm)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden'
    }
  }, icon(ICONS.media, 22));
  row.appendChild(thumbBox);

  // Populate thumbnail lazily
  (async () => {
    try {
      const doc = await openPdf(pdf.data);
      const page = await doc.getPage(1);
      const dataUrl = await renderThumbnail(page, 128);
      thumbBox.innerHTML = '';
      thumbBox.appendChild(el('img', { src: dataUrl, style: { width: '100%', height: '100%', objectFit: 'cover' } }));
    } catch {
      // leave placeholder
    }
  })();

  const info = el('div', { class: 'grow', style: { minWidth: 0 } },
    el('div', { style: { fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, pdf.name),
    el('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)' } },
      `${pdf.pageCount || '?'} page${pdf.pageCount === 1 ? '' : 's'} · ${formatBytes(pdf.size)} · ${new Date(pdf.createdAt).toLocaleDateString()}`)
  );
  row.appendChild(info);

  const actions = el('div', { style: { display: 'flex', gap: '4px' } },
    el('button', { class: 'icon-btn', title: 'Add to deck', 'aria-label': 'Add to deck',
      onclick: () => addPdfToDeck(pdf) }, icon(ICONS.plus, 16)),
    el('button', { class: 'icon-btn', title: 'Rename', 'aria-label': 'Rename',
      onclick: () => renamePdfDialog(pdf) }, icon(ICONS.edit, 16)),
    el('button', { class: 'icon-btn', title: 'Delete', 'aria-label': 'Delete',
      onclick: () => removePdf(pdf) }, icon(ICONS.trash, 16))
  );
  row.appendChild(actions);

  return row;
}

/* ============================================================
   Upload
   ============================================================ */

function openUploadDialog() {
  const fileInput = el('input', {
    type: 'file', accept: 'application/pdf', multiple: true,
    style: { display: 'block', width: '100%', padding: 'var(--space-4)',
             border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)',
             background: 'var(--bg-input)', cursor: 'pointer' }
  });

  const status = el('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-3)' } });

  const body = el('div', {},
    el('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' } },
      'Select one or more PDF files. They are stored in your browser (IndexedDB), not uploaded to any server.'),
    fileInput,
    status
  );

  const api = openModal({
    title: 'Upload PDFs',
    body,
    footer: [
      el('button', { class: 'btn btn-secondary', onclick: () => api.close() }, 'Close')
    ]
  });

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    let ok = 0;
    for (const file of files) {
      status.textContent = `Processing ${file.name}…`;
      try {
        const buf = await file.arrayBuffer();
        const doc = await openPdf(buf);
        await savePdf({ name: file.name, data: buf, pageCount: doc.numPages, size: file.size });
        ok++;
      } catch (e) {
        toast(`Failed: ${file.name} — ${e.message}`, 'error');
      }
    }
    status.textContent = `Done. Added ${ok} of ${files.length}.`;
    if (ok) {
      toast(`Added ${ok} PDF${ok === 1 ? '' : 's'}`, 'success');
      fileInput.value = '';
      rerender();
    }
  });
}

async function removePdf(pdf) {
  const ok = await confirmDialog({
    title: 'Delete PDF?',
    message: `"${pdf.name}" will be removed from this browser. Decks that reference it will show missing pages.`,
    confirmText: 'Delete'
  });
  if (!ok) return;
  await deletePdf(pdf.id);
  toast('PDF removed', 'success');
  rerender();
}

function renamePdfDialog(pdf) {
  const input = el('input', { class: 'input', value: pdf.name });
  const api = openModal({
    title: 'Rename PDF',
    body: el('div', { class: 'field' }, el('label', {}, 'Name'), input),
    footer: [
      el('button', { class: 'btn btn-secondary', onclick: () => api.close() }, 'Cancel'),
      el('button', { class: 'btn btn-primary', onclick: async () => {
        const v = input.value.trim();
        if (!v) { toast('Name required', 'error'); return; }
        await renamePdf(pdf.id, v);
        api.close();
        rerender();
      }}, 'Save')
    ]
  });
}

/* ============================================================
   Decks
   ============================================================ */

async function renderDecks(root) {
  root.innerHTML = '';
  const decks = await listDecks();

  root.appendChild(el('div', { class: 'card-header' },
    el('div', {},
      el('div', { class: 'card-title' }, 'Service Decks'),
      el('div', { class: 'card-subtitle' }, `${decks.length} deck${decks.length === 1 ? '' : 's'}`)
    ),
    el('button', { class: 'btn btn-secondary btn-sm', onclick: () => openDeckEditor() },
      icon(ICONS.plus, 14), 'New')
  ));

  if (!decks.length) {
    root.appendChild(emptyState({
      iconPath: ICONS.setlist,
      title: 'No decks yet',
      description: 'A deck is an ordered list of PDF pages and announcements, ready for a service.',
      action: el('button', { class: 'btn btn-primary', onclick: () => openDeckEditor() },
        icon(ICONS.plus), 'Create deck')
    }));
    return;
  }

  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } });
  root.appendChild(list);
  decks.forEach((deck) => list.appendChild(renderDeckRow(deck)));
}

function renderDeckRow(deck) {
  const count = (deck.items || []).length;
  return el('div', { style: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    padding: 'var(--space-3)', background: 'var(--bg-raised)',
    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'
  }},
    el('div', { class: 'grow', style: { minWidth: 0 } },
      el('div', { style: { fontWeight: 600, fontSize: 'var(--text-sm)' } }, deck.name || 'Untitled deck'),
      el('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)' } },
        `${count} item${count === 1 ? '' : 's'} · updated ${new Date(deck.updatedAt || deck.createdAt || Date.now()).toLocaleString()}`)
    ),
    el('div', { style: { display: 'flex', gap: '4px' } },
      el('button', { class: 'btn btn-primary btn-sm', onclick: () => presentDeck(deck.id) },
        icon(ICONS.play, 14), 'Present'),
      el('button', { class: 'icon-btn', title: 'Edit', 'aria-label': 'Edit',
        onclick: () => openDeckEditor(deck.id) }, icon(ICONS.edit, 16)),
      el('button', { class: 'icon-btn', title: 'Delete', 'aria-label': 'Delete',
        onclick: () => removeDeck(deck) }, icon(ICONS.trash, 16))
    )
  );
}

async function removeDeck(deck) {
  const ok = await confirmDialog({
    title: 'Delete deck?',
    message: `"${deck.name}" will be deleted. This does not delete the PDFs inside it.`,
    confirmText: 'Delete'
  });
  if (!ok) return;
  await deleteDeck(deck.id);
  toast('Deck deleted', 'success');
  rerender();
}

async function addPdfToDeck(pdf) {
  // Quick action: append all pages of this PDF to the most recent deck,
  // creating one if none exists.
  const decks = await listDecks();
  let deck = decks[0];

  if (!deck) {
    deck = { id: null, name: 'Sunday Service', items: [] };
  }

  let doc;
  try {
    doc = await openPdf(pdf.data);
  } catch (e) {
    toast('Cannot open PDF: ' + e.message, 'error');
    return;
  }

  const newItems = [...(deck.items || [])];
  for (let i = 1; i <= doc.numPages; i++) {
    newItems.push({ kind: 'pdf', pdfId: pdf.id, pdfName: pdf.name, page: i });
  }
  deck.items = newItems;

  await saveDeck(deck);
  toast(`Added ${pdf.name} (${doc.numPages} pages) to "${deck.name}"`, 'success');
  rerender();
}

/* ============================================================
   Deck editor
   ============================================================ */

async function openDeckEditor(deckId) {
  const [pdfs, existing] = await Promise.all([
    listPdfs(),
    deckId ? getDeck(deckId) : Promise.resolve(null)
  ]);

  const draft = existing
    ? { ...existing, items: [...(existing.items || [])] }
    : { id: null, name: 'New Service', items: [] };

  const nameInput = el('input', { class: 'input', value: draft.name,
    oninput: (e) => { draft.name = e.target.value; } });

  const itemsBox = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } });
  const refreshItems = () => {
    itemsBox.innerHTML = '';
    if (!draft.items.length) {
      itemsBox.appendChild(el('p', { style: { color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-3)' } },
        'No items yet. Add pages from the library below.'));
      return;
    }
    draft.items.forEach((item, idx) => {
      itemsBox.appendChild(renderDeckItemEditor(item, idx, () => {
        draft.items.splice(idx, 1);
        refreshItems();
      }, (from, to) => {
        const [m] = draft.items.splice(from, 1);
        draft.items.splice(to, 0, m);
        refreshItems();
      }, idx));
    });
  };
  refreshItems();

  const libraryBox = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } });

  if (!pdfs.length) {
    libraryBox.appendChild(el('p', { style: { color: 'var(--text-muted)', fontSize: 'var(--text-sm)' } },
      'No PDFs in the library. Upload one first.'));
  } else {
    pdfs.forEach((pdf) => {
      libraryBox.appendChild(el('div', { style: {
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-raised)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'
      }},
        el('div', { class: 'grow', style: { minWidth: 0 } },
          el('div', { style: { fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, pdf.name),
          el('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)' } }, `${pdf.pageCount || '?'} pages`)
        ),
        el('button', { class: 'btn btn-secondary btn-sm', onclick: () => {
          // append all pages
          for (let i = 1; i <= (pdf.pageCount || 0); i++) {
            draft.items.push({ kind: 'pdf', pdfId: pdf.id, pdfName: pdf.name, page: i });
          }
          refreshItems();
        }}, 'Add all'),
        el('button', { class: 'btn btn-secondary btn-sm', onclick: () => {
          // append one page (prompt)
          const n = parseInt(prompt(`Which page of "${pdf.name}"? (1–${pdf.pageCount || '?'})`, '1'), 10);
          if (!n || n < 1) return;
          draft.items.push({ kind: 'pdf', pdfId: pdf.id, pdfName: pdf.name, page: n });
          refreshItems();
        }}, 'Add page')
      ));
    });
  }

  const body = el('div', { class: 'builder-grid' },
    el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'Deck name'), nameInput),
      el('div', { class: 'field' },
        el('label', {}, `Items (${draft.items.length})`),
        itemsBox
      )
    ),
    el('div', {},
      el('div', { class: 'card-title', style: { marginBottom: 'var(--space-3)' } }, 'Library'),
      libraryBox
    )
  );

  const saveBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
    if (!draft.name.trim()) { toast('Deck name required', 'error'); return; }
    const saved = await saveDeck(draft);
    toast('Deck saved', 'success');
    api.close();
    // Present immediately if the user wants
    if (confirm('Open presenter for this deck now?')) presentDeck(saved.id);
    else rerender();
  }}, 'Save deck');

  const presentBtn = el('button', { class: 'btn btn-secondary', onclick: async () => {
    const saved = await saveDeck(draft);
    api.close();
    presentDeck(saved.id);
  }}, icon(ICONS.play, 14), 'Save & Present');

  const api = openModal({
    title: existing ? 'Edit deck' : 'New deck',
    body,
    footer: [
      el('button', { class: 'btn btn-secondary', onclick: () => api.close() }, 'Cancel'),
      presentBtn,
      saveBtn
    ],
    size: 'lg'
  });
}

function renderDeckItemEditor(item, idx, onRemove, onMove, currentIdx) {
  const label = item.kind === 'pdf'
    ? `${item.pdfName || 'PDF'} — page ${item.page}`
    : item.kind === 'announce'
      ? `Announcement: ${item.title || ''}`
      : 'Item';

  return el('div', { style: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-raised)',
    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'
  }},
    el('span', { style: { width: '22px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'right' } }, String(idx + 1)),
    el('div', { class: 'grow', style: { fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
    el('button', { class: 'icon-btn', title: 'Move up', disabled: idx === 0,
      onclick: () => onMove(idx, idx - 1) }, '↑'),
    el('button', { class: 'icon-btn', title: 'Move down',
      onclick: () => onMove(idx, idx + 1) }, '↓'),
    el('button', { class: 'icon-btn', title: 'Remove', onclick: onRemove }, icon(ICONS.close, 14))
  );
}

/* ============================================================
   Presenter
   ============================================================ */

async function presentDeck(deckId) {
  localStorage.setItem(LAST_DECK_KEY, deckId);
  const url = `${location.pathname}?present=${encodeURIComponent(deckId)}`;
  const w = 1280, h = 800;
  const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
  const win = window.open(url, 'JFCM_PRESENTER',
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no`);

  if (!win) {
    toast('Popup blocked. Please allow popups for this site.', 'error');
    return;
  }
  // The presenter page (rendered by main.js when ?present= is present)
  // takes over from here.
}

/* ============================================================
   Helpers
   ============================================================ */

function formatBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}