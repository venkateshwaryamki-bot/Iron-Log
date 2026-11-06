window.IL = window.IL || {};

IL.History = function () {
  const s = IL.useStore();
  const sessions = IL.doneSessions(s);
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));

  let lastMonth = null;
  return html`<div className="page page-narrow">
    <div className="page-head">
      <div><div className="sub">${sessions.length} workout${sessions.length === 1 ? '' : 's'} logged</div><h1>History</h1></div>
      ${sessions.length > 1 && (compare
        ? html`<div className="row-wrap">
            <button className="btn btn-ghost" onClick=${() => { setCompare(false); setPicked([]); }}>Cancel</button>
            <button className="btn btn-primary" disabled=${picked.length !== 2}
              onClick=${() => { const [a, b] = picked.map((id) => sessions.find((x) => x.id === id)).sort((x, y) => x.startedAt - y.startedAt); IL.nav('/compare/' + a.id + '/' + b.id); }}>
              Compare ${picked.length}/2</button></div>`
        : html`<button className="btn" onClick=${() => setCompare(true)}><${Icon} name="compare" size=${16} /> Compare</button>`)}
    </div>
    ${compare && html`<p className="small muted" style=${{ marginTop: -10 }}>Select two workouts to compare.</p>`}
    ${sessions.length === 0 && html`<div className="card"><${IL.Empty}>No workouts yet. Finished sessions show up here.
      <div className="mt"><button className="btn btn-primary" onClick=${() => IL.nav('/workout')}>Start a workout</button></div><//></div>`}
    <div className="stack-sm">
      ${sessions.map((x) => {
        const month = new Date(x.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        const head = month !== lastMonth ? html`<div className="label" style=${{ marginTop: lastMonth ? 18 : 0 }}>${month}</div>` : null;
        lastMonth = month;
        const t = IL.stats.sessionTotals(x);
        const sel = picked.includes(x.id);
        return html`<${React.Fragment} key=${x.id}>${head}
          <div className="card tight clickable row" style=${sel ? { borderColor: 'var(--accent)' } : null}
            onClick=${() => (compare ? toggle(x.id) : IL.nav('/history/' + x.id))}>
            ${compare && html`<span className=${'check-btn' + (sel ? ' on' : '')} style=${{ width: 28, height: 28 }}><${Icon} name="check" size=${15} /></span>`}
            <div style=${{ width: 44, textAlign: 'center' }}>
              <div className="label" style=${{ fontSize: 11 }}>${IL.DAY_SHORT[IL.time.dayIdx(x.startedAt)]}</div>
              <div style=${{ fontSize: 20, fontWeight: 700 }} className="num">${new Date(x.startedAt).getDate()}</div>
            </div>
            <div className="grow">
              <div style=${{ fontWeight: 650 }} className="ellipsis">${x.name}</div>
              <div className="tiny muted ellipsis">${x.entries.filter((e) => IL.stats.doneSets(e).length).map((e) => IL.describeVariation(s, e.variationId, e).name).join(' · ') || 'No completed sets'}</div>
              <div className="tiny text-2 num" style=${{ marginTop: 3 }}>${t.exercises} exercises · ${t.sets} sets · ${t.reps} reps · ${IL.fmt.int(t.volume)} kg · ${IL.fmt.duration(t.duration)}</div>
              ${x.notes && html`<div className="tiny muted ellipsis" style=${{ marginTop: 2 }}>“${x.notes}”</div>`}
            </div>
            ${!compare && html`<${Icon} name="chevronRight" size=${16} />`}
          </div>
        <//>`;
      })}
    </div>
  </div>`;
};

IL.SessionDetail = function ({ id }) {
  const s = IL.useStore();
  const x = s.sessions.find((y) => y.id === id);
  if (!x) return html`<div className="page"><${IL.Empty}>Workout not found.<//></div>`;
  const t = IL.stats.sessionTotals(x);
  const prs = IL.stats.sessionPRs(s, x);
  const del = async () => {
    if (await IL.confirm({ title: 'Delete this workout?', message: `“${x.name}” on ${IL.fmt.date(x.startedAt)} and all its sets will be permanently removed.`, confirmLabel: 'Delete', danger: true })) {
      IL.store.remove('sessions', x.id);
      IL.toast('Workout deleted');
      IL.nav('/history');
    }
  };
  return html`<div className="page page-narrow">
    <button className="btn btn-ghost btn-sm" onClick=${() => IL.nav('/history')}><${Icon} name="chevronLeft" size=${14} /> History</button>
    <div className="page-head mt">
      <div><div className="sub">${IL.fmt.weekday(x.startedAt)} · ${IL.fmt.time(x.startedAt)}</div><h1>${x.name}</h1></div>
      ${x.status === 'done' && html`<div className="row-wrap">
        <button className="btn" onClick=${() => IL.nav('/history/' + x.id + '/edit')}><${Icon} name="edit" size=${15} /> Edit</button>
        <button className="btn btn-danger" onClick=${del}><${Icon} name="trash" size=${15} /> Delete</button>
      </div>`}
    </div>
    <div className="grid grid-4">
      ${[['Duration', IL.fmt.duration(t.duration)], ['Volume', IL.fmt.int(t.volume) + ' kg'], ['Sets', t.sets], ['Reps', t.reps]].map(([l, v]) => html`
        <div key=${l} className="card tight stat"><div className="label">${l}</div><div className="stat-value" style=${{ fontSize: 21 }}>${v}</div></div>`)}
    </div>
    ${x.notes && html`<div className="card tight mt"><div className="label">Notes</div><div style=${{ marginTop: 4, whiteSpace: 'pre-wrap' }}>${x.notes}</div></div>`}
    <div className="stack mt">
      ${x.entries.map((e) => {
        const d = IL.describeVariation(s, e.variationId, e);
        return html`<div key=${e.id} className="card tight">
          <div className="row between">
            <span className="ex-title" onClick=${() => IL.nav('/exercise/' + e.variationId)}>${d.name}</span>
            <div className="row-wrap">
              ${prs.volume[e.id] && html`<span className="badge pr">Volume PR</span>`}
              ${e.skipped ? html`<span className="badge">Skipped</span>` : html`<span className="small muted num">${IL.fmt.int(IL.stats.entryVolume(e))} kg</span>`}
            </div>
          </div>
          ${!e.skipped && html`<table className="table" style=${{ marginTop: 6 }}>
            <thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th style=${{ textAlign: 'right' }}>Volume</th></tr></thead>
            <tbody>${e.sets.map((st, i) => html`<tr key=${st.id} style=${st.done ? null : { opacity: 0.45 }}>
              <td>${i + 1} ${prs.sets[st.id] && html`<span className="badge pr" style=${{ marginLeft: 4 }}>${prs.sets[st.id] === 'weight' ? 'Weight PR' : 'Rep PR'}</span>`}</td>
              <td>${IL.fmt.w(st.weight)} kg</td><td>${st.reps}</td>
              <td style=${{ textAlign: 'right' }}>${st.done ? IL.fmt.int(st.weight * st.reps) : 'not done'}</td></tr>`)}</tbody>
          </table>`}
          ${e.notes && html`<div className="small text-2" style=${{ marginTop: 8, whiteSpace: 'pre-wrap' }}><${Icon} name="note" size=${13} /> ${e.notes}</div>`}
        </div>`;
      })}
    </div>
  </div>`;
};

IL.Compare = function ({ a, b }) {
  const s = IL.useStore();
  const A = s.sessions.find((x) => x.id === a), B = s.sessions.find((x) => x.id === b);
  if (!A || !B) return html`<div className="page"><${IL.Empty}>Workout not found.<//></div>`;
  const ta = IL.stats.sessionTotals(A), tb = IL.stats.sessionTotals(B);
  const sum = (sess, vid) => {
    const sets = [];
    sess.entries.forEach((e) => { if (e.variationId === vid) sets.push(...IL.stats.doneSets(e)); });
    if (!sets.length) return null;
    const top = sets.reduce((m, x) => (Number(x.weight) > Number(m.weight) || (Number(x.weight) === Number(m.weight) && x.reps > m.reps) ? x : m), sets[0]);
    return { sets, top, vol: sets.reduce((v, x) => v + x.weight * x.reps, 0) };
  };
  const vids = [];
  [A, B].forEach((sess) => sess.entries.forEach((e) => { if (!vids.includes(e.variationId)) vids.push(e.variationId); }));
  const delta = (x, y, fmt) => {
    const d = y - x;
    if (!d) return html`<span className="muted">±0</span>`;
    return html`<span className=${d > 0 ? 'up' : 'down'}>${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}</span>`;
  };
  const col = (sess, t) => html`<div className="card tight">
    <div className="label">${IL.fmt.date(sess.startedAt)}</div>
    <div style=${{ fontWeight: 650, marginTop: 2 }} className="ellipsis">${sess.name}</div>
    <div className="tiny text-2 num">${t.sets} sets · ${t.reps} reps · ${IL.fmt.int(t.volume)} kg · ${IL.fmt.duration(t.duration)}</div></div>`;
  return html`<div className="page">
    <button className="btn btn-ghost btn-sm" onClick=${() => IL.nav('/history')}><${Icon} name="chevronLeft" size=${14} /> History</button>
    <div className="page-head mt"><h1>Compare workouts</h1></div>
    <div className="grid grid-2">${col(A, ta)}${col(B, tb)}</div>
    <div className="card mt">
      <div className="row-wrap small" style=${{ marginBottom: 10 }}>
        <span className="muted">Change in total volume:</span> <b>${delta(ta.volume, tb.volume, (v) => IL.fmt.int(v) + ' kg')}</b>
        <span className="muted" style=${{ marginLeft: 10 }}>Sets:</span> <b>${delta(ta.sets, tb.sets, String)}</b>
      </div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Exercise</th><th>${IL.fmt.dateShort(A.startedAt)}</th><th>${IL.fmt.dateShort(B.startedAt)}</th><th style=${{ textAlign: 'right' }}>Volume Δ</th></tr></thead>
        <tbody>${vids.map((vid) => {
          const x = sum(A, vid), y = sum(B, vid);
          const name = IL.describeVariation(s, vid, A.entries.find((e) => e.variationId === vid) || B.entries.find((e) => e.variationId === vid)).name;
          const cell = (v) => (v ? html`<div className="num">${IL.fmt.w(v.top.weight)} × ${v.top.reps}</div>
            <div className="tiny muted num">${v.sets.length} sets · ${IL.fmt.int(v.vol)} kg</div>` : html`<span className="muted">—</span>`);
          return html`<tr key=${vid}><td style=${{ fontWeight: 550 }}>${name}</td><td>${cell(x)}</td><td>${cell(y)}</td>
            <td style=${{ textAlign: 'right' }}>${x && y ? delta(x.vol, y.vol, IL.fmt.int) : html`<span className="muted">—</span>`}</td></tr>`;
        })}</tbody>
      </table></div>
      <p className="tiny muted">Only the same variation is compared row by row — different variations are never merged.</p>
    </div>
  </div>`;
};
