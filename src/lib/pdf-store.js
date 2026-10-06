// src/lib/pdf-store.js
// Tiny IndexedDB wrapper for storing PDFs and decks. No dependencies.

const DB_NAME = 'jfcm-media';
const DB_VERSION = 1;
const STORE_PDFS = 'pdfs';
const STORE_DECKS = 'decks';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DECKS)) {
        db.createObjectStore(STORE_DECKS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const result = fn(s);
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const uid = () => 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

/* ---------- PDFs ---------- */

export async function savePdf({ name, data, pageCount, size }) {
  const id = uid();
  const record = {
    id,
    name,
    data,                    // ArrayBuffer or Blob
    pageCount: pageCount || 0,
    size: size || (data.byteLength ?? data.size ?? 0),
    createdAt: Date.now()
  };
  await tx(STORE_PDFS, 'readwrite', (s) => s.put(record));
  return record;
}

export async function getPdf(id) {
  return tx(STORE_PDFS, 'readonly', (s) => s.get(id));
}

export async function listPdfs() {
  const all = await tx(STORE_PDFS, 'readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deletePdf(id) {
  await tx(STORE_PDFS, 'readwrite', (s) => s.delete(id));
}

export async function renamePdf(id, name) {
  const rec = await getPdf(id);
  if (!rec) return;
  rec.name = name;
  await tx(STORE_PDFS, 'readwrite', (s) => s.put(rec));
}

/* ---------- Decks ---------- */

export async function saveDeck(deck) {
  const id = deck.id || 'd_' + Date.now().toString(36);
  const record = { ...deck, id, updatedAt: Date.now() };
  await tx(STORE_DECKS, 'readwrite', (s) => s.put(record));
  return record;
}

export async function getDeck(id) {
  return tx(STORE_DECKS, 'readonly', (s) => s.get(id));
}

export async function listDecks() {
  const all = await tx(STORE_DECKS, 'readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteDeck(id) {
  await tx(STORE_DECKS, 'readwrite', (s) => s.delete(id));
}