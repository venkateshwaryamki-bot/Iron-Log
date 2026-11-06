// In-memory cache of the whole database with write-through persistence.
// Components subscribe via IL.useStore(); every mutation persists and re-renders.
window.IL = window.IL || {};

IL.store = (function () {
  let state = { exercises: [], variations: [], plans: [], sessions: [], meta: [] };
  let version = 0;
  const listeners = new Set();
  let lastSave = 0;

  function emit() { version++; listeners.forEach((l) => l()); }
  function onSaved() { lastSave = Date.now(); }
  function onError(err) { console.error(err); alert('Could not save data: ' + (err && err.message)); }

  async function init() {
    await IL.db.open();
    let data = await IL.db.loadAll();
    if (!data.meta.find((m) => m.id === 'settings')) {
      const seed = IL.buildSeed();
      for (const s of IL.db.STORES) await IL.db.bulkPut(s, seed[s]);
      data = seed;
    }
    state = data;
    emit();
  }

  function put(store, obj) {
    const arr = state[store];
    const i = arr.findIndex((x) => x.id === obj.id);
    const next = arr.slice();
    if (i >= 0) next[i] = obj; else next.push(obj);
    state = { ...state, [store]: next };
    emit();
    IL.db.put(store, obj).then(onSaved, onError);
    return obj;
  }

  function remove(store, id) {
    state = { ...state, [store]: state[store].filter((x) => x.id !== id) };
    emit();
    IL.db.remove(store, id).then(onSaved, onError);
  }

  async function replaceAll(data) {
    await IL.db.clearAll();
    for (const s of IL.db.STORES) await IL.db.bulkPut(s, data[s] || []);
    state = { exercises: [], variations: [], plans: [], sessions: [], meta: [], ...data };
    emit();
  }

  async function reset() {
    await IL.db.clearAll();
    await init();
  }

  return {
    init, put, remove, replaceAll, reset,
    get: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    getVersion: () => version,
    lastSave: () => lastSave,
  };
})();

IL.useStore = function () {
  React.useSyncExternalStore(IL.store.subscribe, IL.store.getVersion);
  return IL.store.get();
};

// ---------- Selectors & domain helpers ----------
IL.settings = (s) => s.meta.find((m) => m.id === 'settings') || { id: 'settings', theme: 'dark' };
IL.updateSettings = (patch) => IL.store.put('meta', { ...IL.settings(IL.store.get()), ...patch });

IL.activePlan = (s) => {
  const id = IL.settings(s).activePlanId;
  return s.plans.find((p) => p.id === id) || s.plans[0] || null;
};

IL.findVariation = (s, id) => s.variations.find((v) => v.id === id) || null;
IL.findExercise = (s, id) => s.exercises.find((e) => e.id === id) || null;

// Display name for a variation: "Barbell Bench Press" stays as is; "Wide Grip" becomes "Lat Pulldown · Wide Grip".
IL.fullName = (exName, varName) => {
  if (!varName) return exName || 'Unknown exercise';
  if (!exName) return varName;
  return varName.toLowerCase().includes(exName.toLowerCase()) ? varName : exName + ' · ' + varName;
};

// Live names when the variation still exists, falling back to the session snapshot.
IL.describeVariation = (s, variationId, snap) => {
  const v = IL.findVariation(s, variationId);
  const e = v && IL.findExercise(s, v.exerciseId);
  if (v && e) return { exName: e.name, varName: v.name, category: e.category, name: IL.fullName(e.name, v.name), archived: v.archived || e.archived };
  const exName = snap && snap.exName, varName = snap && snap.varName;
  return { exName, varName, category: (snap && snap.category) || 'Other', name: IL.fullName(exName, varName), archived: true };
};

IL.newPlanDays = () => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  .map(() => ({ name: 'Rest', rest: true, items: [] }));

IL.activeSession = (s) => s.sessions.find((x) => x.status === 'active') || null;
IL.doneSessions = (s) => s.sessions.filter((x) => x.status === 'done').sort((a, b) => b.startedAt - a.startedAt);

// Builds a new session from a plan day, prefilling each set from the last time that variation was done.
IL.makeEntry = (s, variationId, targetSets, targetReps, beforeTs) => {
  const d = IL.describeVariation(s, variationId);
  const prev = IL.stats.previousEntry(s, variationId, beforeTs || Date.now(), null);
  const prevSets = prev ? prev.entry.sets.filter((x) => x.done) : [];
  const count = Math.max(targetSets || 0, prevSets.length, 1);
  const last = prevSets[prevSets.length - 1];
  const sets = [];
  for (let i = 0; i < count; i++) {
    const p = prevSets[i] || last;
    sets.push({ id: IL.uid(), weight: p ? p.weight : 0, reps: p ? p.reps : (targetReps || 10), done: false });
  }
  return { id: IL.uid(), variationId, exName: d.exName, varName: d.varName, category: d.category, skipped: false, notes: '', sets };
};

IL.startSession = (s, plan, dayIdx) => {
  const day = plan && dayIdx != null ? plan.days[dayIdx] : null;
  const now = Date.now();
  const session = {
    id: IL.uid(),
    planId: plan ? plan.id : null,
    dayIdx: day ? dayIdx : null,
    name: day && !day.rest ? day.name : 'Freestyle Workout',
    startedAt: now,
    finishedAt: null,
    status: 'active',
    notes: '',
    entries: day && !day.rest ? day.items.map((it) => IL.makeEntry(s, it.variationId, it.sets, it.reps, now)) : [],
  };
  return IL.store.put('sessions', session);
};
