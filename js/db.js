// IndexedDB persistence. One object store per entity, all keyed by `id`.
//
// Schema (relationships by id):
//   exercises  { id, name, category, custom, archived, createdAt }
//   variations { id, exerciseId -> exercises.id, name, custom, archived, createdAt }
//   plans      { id, name, createdAt, days[7] (Mon..Sun): { name, rest, items: [{ id, variationId -> variations.id, sets, reps }] } }
//   sessions   { id, planId, dayIdx, name, startedAt, finishedAt, status: 'active'|'done', notes,
//                entries: [{ id, variationId -> variations.id, exName, varName, category, skipped, notes,
//                            sets: [{ id, weight, reps, done }] }] }
//   meta       { id: 'settings', theme, activePlanId }
//
// Sessions snapshot exercise/variation names so history survives renames, deletions
// and plan changes; performance is always grouped by variationId.
window.IL = window.IL || {};

IL.db = (function () {
  const DB_NAME = 'ironlog';
  const VERSION = 1;
  const STORES = ['exercises', 'variations', 'plans', 'sessions', 'meta'];
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not available in this browser.'));
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        STORES.forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Database is blocked by another open tab.'));
    });
  }

  function write(store, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      fn(t.objectStore(store));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  function getAll(store) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadAll() {
    const out = {};
    for (const s of STORES) out[s] = await getAll(s);
    return out;
  }

  const put = (store, obj) => write(store, (s) => s.put(obj));
  const bulkPut = (store, arr) => write(store, (s) => arr.forEach((o) => s.put(o)));
  const remove = (store, id) => write(store, (s) => s.delete(id));
  const clearAll = async () => { for (const s of STORES) await write(s, (st) => st.clear()); };

  return { STORES, open, loadAll, put, bulkPut, remove, clearAll };
})();
