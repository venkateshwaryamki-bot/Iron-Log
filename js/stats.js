// Calculations: volume, previous performance, records/PRs, streaks, date helpers.
// Everything is keyed by variationId so variations never get mixed together.
window.IL = window.IL || {};

IL.DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
IL.DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_MS = 86400000;

IL.time = {
  dayIdx: (d) => (new Date(d).getDay() + 6) % 7, // 0 = Monday
  startOfDay: (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); },
  startOfWeek: (d) => { const x = new Date(IL.time.startOfDay(d)); x.setDate(x.getDate() - IL.time.dayIdx(x)); return x.getTime(); },
  addDays: (ts, n) => { const x = new Date(ts); x.setDate(x.getDate() + n); return x.getTime(); },
  sameDay: (a, b) => IL.time.startOfDay(a) === IL.time.startOfDay(b),
};

IL.fmt = {
  w: (n) => { const v = Number(n) || 0; return String(parseFloat(v.toFixed(2))); },
  int: (n) => Math.round(Number(n) || 0).toLocaleString(),
  vol: (n) => {
    const v = Number(n) || 0;
    if (v >= 100000) return (v / 1000).toFixed(0) + 'k';
    if (v >= 10000) return parseFloat((v / 1000).toFixed(1)) + 'k';
    return Math.round(v).toLocaleString();
  },
  date: (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
  dateShort: (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  weekday: (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
  time: (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  duration: (ms) => {
    if (!ms || ms < 0) return '—';
    const m = Math.round(ms / 60000);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  },
  clock: (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
  },
};

IL.stats = (function () {
  const setVol = (st) => (st.done ? (Number(st.weight) || 0) * (Number(st.reps) || 0) : 0);
  const doneSets = (entry) => (entry.skipped ? [] : entry.sets.filter((x) => x.done));
  const entryVolume = (entry) => doneSets(entry).reduce((a, st) => a + setVol(st), 0);

  function sessionTotals(session) {
    let volume = 0, sets = 0, reps = 0, exercises = 0;
    session.entries.forEach((e) => {
      const ds = doneSets(e);
      if (ds.length) exercises++;
      ds.forEach((st) => { volume += setVol(st); sets++; reps += Number(st.reps) || 0; });
    });
    const duration = session.finishedAt ? session.finishedAt - session.startedAt : Date.now() - session.startedAt;
    return { volume, sets, reps, exercises, duration };
  }

  const done = (s) => s.sessions.filter((x) => x.status === 'done');

  // Most recent completed session (before `beforeTs`) where this exact variation had completed sets.
  function previousEntry(s, variationId, beforeTs, excludeId) {
    let best = null;
    done(s).forEach((sess) => {
      if (sess.id === excludeId || sess.startedAt >= beforeTs) return;
      const entry = sess.entries.find((e) => e.variationId === variationId && doneSets(e).length);
      if (entry && (!best || sess.startedAt > best.session.startedAt)) best = { session: sess, entry };
    });
    return best;
  }

  // One row per completed session for a variation, oldest first.
  function history(s, variationId) {
    const rows = [];
    done(s).forEach((sess) => {
      const sets = [];
      sess.entries.forEach((e) => { if (e.variationId === variationId) sets.push(...doneSets(e)); });
      if (!sets.length) return;
      let topWeight = 0, topWeightReps = 0, maxReps = 0, volume = 0, e1rm = 0;
      sets.forEach((st) => {
        const w = Number(st.weight) || 0, r = Number(st.reps) || 0;
        if (w > topWeight || (w === topWeight && r > topWeightReps)) { topWeight = w; topWeightReps = r; }
        maxReps = Math.max(maxReps, r);
        volume += w * r;
        e1rm = Math.max(e1rm, r > 0 ? w * (1 + r / 30) : 0); // Epley estimate
      });
      rows.push({ session: sess, date: sess.startedAt, sets, topWeight, topWeightReps, maxReps, volume, e1rm });
    });
    return rows.sort((a, b) => a.date - b.date);
  }

  function records(s, variationId) {
    const rows = history(s, variationId);
    const r = { sessions: rows.length, maxWeight: 0, maxWeightReps: 0, maxWeightDate: null, maxReps: 0, maxRepsDate: null,
      bestVolume: 0, bestVolumeDate: null, bestSet: null, totalVolume: 0, e1rm: 0, last: rows[rows.length - 1] || null };
    rows.forEach((row) => {
      r.totalVolume += row.volume;
      if (row.topWeight > r.maxWeight || (row.topWeight === r.maxWeight && row.topWeightReps > r.maxWeightReps)) {
        r.maxWeight = row.topWeight; r.maxWeightReps = row.topWeightReps; r.maxWeightDate = row.date;
      }
      if (row.maxReps > r.maxReps) { r.maxReps = row.maxReps; r.maxRepsDate = row.date; }
      if (row.volume > r.bestVolume) { r.bestVolume = row.volume; r.bestVolumeDate = row.date; }
      r.e1rm = Math.max(r.e1rm, row.e1rm);
      row.sets.forEach((st) => { const v = setVol(st); if (!r.bestSet || v > r.bestSet.vol) r.bestSet = { vol: v, weight: st.weight, reps: st.reps, date: row.date }; });
    });
    return r;
  }

  // PRs set during `session`, compared against everything before it.
  // A weight PR beats the heaviest weight ever; a rep PR beats the best reps at that weight or heavier.
  // The first time a variation is logged sets no PRs (there's nothing to beat).
  function sessionPRs(s, session) {
    const sets = {};   // setId -> 'weight' | 'reps'
    const volume = {}; // entryId -> true
    const list = [];
    const prior = {};
    done(s).forEach((sess) => {
      if (sess.id === session.id || sess.startedAt >= session.startedAt) return;
      sess.entries.forEach((e) => {
        const ds = doneSets(e);
        if (!ds.length) return;
        const p = prior[e.variationId] || (prior[e.variationId] = { sets: [], bestVolume: 0 });
        p.sets.push(...ds.map((x) => ({ w: Number(x.weight) || 0, r: Number(x.reps) || 0 })));
        p.bestVolume = Math.max(p.bestVolume, entryVolume(e));
      });
    });
    session.entries.forEach((e) => {
      const p = prior[e.variationId];
      if (!p || !p.sets.length) return;
      const running = p.sets.slice();
      doneSets(e).forEach((st) => {
        const w = Number(st.weight) || 0, r = Number(st.reps) || 0;
        const maxW = Math.max(...running.map((x) => x.w));
        const heavier = running.filter((x) => x.w >= w);
        if (w > 0 && w > maxW) { sets[st.id] = 'weight'; list.push({ entry: e, kind: 'Weight', value: IL.fmt.w(w) + ' kg × ' + r }); }
        else if (r > 0 && heavier.length && r > Math.max(...heavier.map((x) => x.r))) { sets[st.id] = 'reps'; list.push({ entry: e, kind: 'Reps', value: IL.fmt.w(w) + ' kg × ' + r }); }
        running.push({ w, r });
      });
      const v = entryVolume(e);
      if (v > 0 && v > p.bestVolume) { volume[e.id] = true; list.push({ entry: e, kind: 'Volume', value: IL.fmt.int(v) + ' kg' }); }
    });
    return { sets, volume, list };
  }

  function inRange(s, fromTs, toTs) {
    return done(s).filter((x) => x.startedAt >= fromTs && x.startedAt < toTs);
  }

  // Consecutive training days, where days marked rest in the active plan don't break the run.
  // Today counts only once trained, so an untrained morning doesn't reset the streak.
  function streak(s, plan) {
    const days = new Set(done(s).map((x) => IL.time.startOfDay(x.startedAt)));
    let count = 0;
    let d = IL.time.startOfDay(Date.now());
    if (!days.has(d)) d = IL.time.addDays(d, -1);
    for (let i = 0; i < 730; i++) {
      if (days.has(d)) count++;
      else if (!(plan && plan.days[IL.time.dayIdx(d)].rest)) break;
      d = IL.time.addDays(d, -1);
    }
    return count;
  }

  return { setVol, doneSets, entryVolume, sessionTotals, previousEntry, history, records, sessionPRs, inRange, streak, DAY_MS };
})();
