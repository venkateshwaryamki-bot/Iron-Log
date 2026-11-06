window.IL = window.IL || {};

const RANGES = [['7d', 'Last 7 days', 7], ['30d', 'Last 30 days', 30], ['3m', 'Last 3 months', 91], ['6m', 'Last 6 months', 182], ['all', 'All time', null]];

IL.Analytics = function () {
  const s = IL.useStore();
  const [range, setRange] = useState('30d');
  const all = IL.doneSessions(s);
  const days = RANGES.find((r) => r[0] === range)[2];
  const today = IL.time.startOfDay(Date.now());
  const first = all.length ? IL.time.startOfDay(all[all.length - 1].startedAt) : today;
  const from = days ? IL.time.addDays(today, -(days - 1)) : first;
  const to = IL.time.addDays(today, 1);
  const sessions = all.filter((x) => x.startedAt >= from && x.startedAt < to);

  const totals = sessions.reduce((a, x) => { const t = IL.stats.sessionTotals(x); a.volume += t.volume; a.sets += t.sets; a.duration += t.duration; return a; }, { volume: 0, sets: 0, duration: 0 });

  // Consistency: trained days vs. training days scheduled in the active plan (from first log onward).
  const plan = IL.activePlan(s);
  const consFrom = Math.max(from, first);
  let planned = 0;
  for (let d = consFrom; d < to; d = IL.time.addDays(d, 1)) if (plan && !plan.days[IL.time.dayIdx(d)].rest) planned++;
  const trainedDays = new Set(sessions.map((x) => IL.time.startOfDay(x.startedAt))).size;
  const consistency = planned ? Math.min(100, Math.round((trainedDays / planned) * 100)) : 0;

  // Weekly buckets (max 52 visible).
  const weeks = [];
  for (let w = IL.time.startOfWeek(from); w < to; w = IL.time.addDays(w, 7)) weeks.push(w);
  const weekly = weeks.slice(-52).map((w) => {
    const ss = sessions.filter((x) => x.startedAt >= w && x.startedAt < IL.time.addDays(w, 7));
    return { label: IL.fmt.dateShort(w), tip: 'Week of ' + IL.fmt.dateShort(w), count: ss.length, volume: ss.reduce((a, x) => a + IL.stats.sessionTotals(x).volume, 0) };
  });
  const months = [];
  const mStart = new Date(from); mStart.setDate(1);
  for (let m = new Date(mStart); m.getTime() < to; m.setMonth(m.getMonth() + 1)) {
    const a = m.getTime(), b = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
    months.push({ label: m.toLocaleDateString(undefined, { month: 'short' }), tip: m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), y: sessions.filter((x) => x.startedAt >= a && x.startedAt < b).length });
  }

  // Muscle group distribution by completed sets.
  const byCat = {};
  sessions.forEach((x) => x.entries.forEach((e) => {
    const n = IL.stats.doneSets(e).length;
    if (n) { const c = IL.describeVariation(s, e.variationId, e).category; byCat[c] = (byCat[c] || 0) + n; }
  }));
  const catRows = Object.entries(byCat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // Variations trained in range.
  const trained = [];
  sessions.forEach((x) => x.entries.forEach((e) => { if (IL.stats.doneSets(e).length && !trained.includes(e.variationId)) trained.push(e.variationId); }));
  const [vid, setVid] = useState(null);
  const selVid = trained.includes(vid) ? vid : trained[0];
  const prog = selVid ? IL.stats.history(s, selVid).filter((h) => h.date >= from) : [];
  let best = -Infinity;
  const progPoints = prog.map((h, i) => { const pr = i > 0 && h.topWeight > best; best = Math.max(best, h.topWeight); return { x: h.date, y: h.topWeight, pr, tip: '× ' + h.topWeightReps + ' reps' }; });

  const records = trained.map((v) => ({ vid: v, d: IL.describeVariation(s, v), r: IL.stats.records(s, v) }))
    .sort((a, b) => (b.r.maxWeightDate || 0) - (a.r.maxWeightDate || 0));

  return html`<div className="page">
    <div className="page-head">
      <div><div className="sub">${days ? IL.fmt.dateShort(from) + ' – today' : 'Since ' + IL.fmt.date(first)}</div><h1>Analytics</h1></div>
      <div className="seg">${RANGES.map(([k, l]) => html`<button key=${k} className=${range === k ? 'active' : ''} onClick=${() => setRange(k)}>${l}</button>`)}</div>
    </div>

    <div className="grid grid-4">
      <div className="card stat"><div className="label">Workouts</div><div className="stat-value">${sessions.length}</div>
        <div className="tiny muted">${trainedDays} training days</div></div>
      <div className="card stat"><div className="label">Total volume</div><div className="stat-value">${IL.fmt.vol(totals.volume)}<span className="stat-unit">kg</span></div>
        <div className="tiny muted">${IL.fmt.int(totals.sets)} sets</div></div>
      <div className="card stat"><div className="label">Avg duration</div><div className="stat-value" style=${{ fontSize: 24 }}>${sessions.length ? IL.fmt.duration(totals.duration / sessions.length) : '—'}</div></div>
      <div className="card stat"><div className="label">Consistency</div><div className="stat-value">${consistency}<span className="stat-unit">%</span></div>
        <div className="progress"><div style=${{ width: consistency + '%' }} /></div>
        <div className="tiny muted" style=${{ marginTop: 6 }}>${trainedDays} of ${planned} planned days</div></div>
    </div>

    ${sessions.length === 0 ? html`<div className="card mt"><${IL.Empty}>No workouts in this period.<//></div>` : html`
    <div className="grid grid-2 mt">
      <div className="card"><div className="card-head"><h2>Workouts per week</h2></div>
        <${IL.BarChart} bars=${weekly.map((w) => ({ label: w.label, tip: w.tip, y: w.count }))} unit=" workouts" /></div>
      <div className="card"><div className="card-head"><h2>Volume per week</h2></div>
        <${IL.BarChart} bars=${weekly.map((w) => ({ label: w.label, tip: w.tip, y: w.volume }))} yFmt=${IL.fmt.vol} unit=" kg" /></div>
      <div className="card"><div className="card-head"><h2>Workouts per month</h2></div>
        <${IL.BarChart} bars=${months} unit=" workouts" /></div>
      <div className="card"><div className="card-head"><h2>Muscle group split</h2><span className="tiny muted">completed sets</span></div>
        <${IL.HBars} rows=${catRows} unit="" /></div>
    </div>

    <div className="card mt">
      <div className="card-head" style=${{ flexWrap: 'wrap' }}>
        <h2>Exercise progression</h2>
        <select className="select" style=${{ width: 'auto', maxWidth: '100%' }} value=${selVid || ''} onChange=${(e) => setVid(e.target.value)}>
          ${trained.map((v) => html`<option key=${v} value=${v}>${IL.describeVariation(s, v).name}</option>`)}
        </select>
      </div>
      <div className="tiny muted" style=${{ marginBottom: 8 }}>Top set weight per session (kg)</div>
      <${IL.LineChart} points=${progPoints} unit=" kg" />
    </div>

    <div className="card mt">
      <div className="card-head"><h2>Personal records</h2><span className="tiny muted">all-time bests for variations trained in this period</span></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Exercise</th><th style=${{ textAlign: 'right' }}>Heaviest</th><th style=${{ textAlign: 'right' }}>Best reps</th><th style=${{ textAlign: 'right' }}>Est. 1RM</th><th style=${{ textAlign: 'right' }}>Set on</th></tr></thead>
        <tbody>${records.map(({ vid: v, d, r }) => html`<tr key=${v} className="clickable" onClick=${() => IL.nav('/exercise/' + v)}>
          <td style=${{ fontWeight: 550 }}>${d.name}<div className="tiny muted">${d.category}</div></td>
          <td style=${{ textAlign: 'right', whiteSpace: 'nowrap' }}>${IL.fmt.w(r.maxWeight)} kg × ${r.maxWeightReps}</td>
          <td style=${{ textAlign: 'right' }}>${r.maxReps}</td>
          <td style=${{ textAlign: 'right' }}>${IL.fmt.w(Math.round(r.e1rm * 10) / 10)} kg</td>
          <td style=${{ textAlign: 'right', whiteSpace: 'nowrap' }} className="muted">${IL.fmt.dateShort(r.maxWeightDate)}</td></tr>`)}</tbody>
      </table></div>
    </div>`}
  </div>`;
};
