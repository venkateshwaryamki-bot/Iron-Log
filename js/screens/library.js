// Exercise library and per-variation progress page.
window.IL = window.IL || {};

IL.variationHasHistory = (s, vid) => s.sessions.some((x) => x.entries.some((e) => e.variationId === vid));

// Variations with history are archived (hidden, history intact); unused ones are removed outright.
// Either way they're taken out of every plan.
IL.deleteVariations = async (s, vids, label) => {
  const uses = s.plans.reduce((a, p) => a + p.days.reduce((b, d) => b + d.items.filter((it) => vids.includes(it.variationId)).length, 0), 0);
  const withHistory = vids.filter((v) => IL.variationHasHistory(s, v)).length;
  const msg = [
    uses ? `It's used ${uses} time${uses === 1 ? '' : 's'} in your plans and will be removed from them.` : '',
    withHistory ? 'Logged workouts are kept and stay visible in History.' : '',
  ].filter(Boolean).join(' ');
  const ok = await IL.confirm({ title: 'Delete ' + label + '?', message: msg || 'This can’t be undone.', confirmLabel: 'Delete', danger: true });
  if (!ok) return false;
  vids.forEach((vid) => {
    const v = IL.findVariation(s, vid);
    if (IL.variationHasHistory(s, vid)) IL.store.put('variations', { ...v, archived: true });
    else IL.store.remove('variations', vid);
  });
  s.plans.forEach((p) => {
    if (!p.days.some((d) => d.items.some((it) => vids.includes(it.variationId)))) return;
    IL.store.put('plans', { ...p, days: p.days.map((d) => ({ ...d, items: d.items.filter((it) => !vids.includes(it.variationId)) })) });
  });
  return true;
};

IL.Library = function () {
  const s = IL.useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [open, setOpen] = useState({});
  const [form, setForm] = useState(null); // { exercise? }
  const [showArchived, setShowArchived] = useState(false);
  const query = q.trim().toLowerCase();

  const rows = s.exercises
    .filter((e) => (cat === 'All' || e.category === cat))
    .map((e) => ({ ex: e, vars: s.variations.filter((v) => v.exerciseId === e.id && (showArchived || !v.archived)) }))
    .filter(({ ex, vars }) => (showArchived || !ex.archived) && (vars.length || !ex.archived))
    .filter(({ ex, vars }) => !query || ex.name.toLowerCase().includes(query) || vars.some((v) => v.name.toLowerCase().includes(query)))
    .sort((a, b) => IL.CATEGORIES.indexOf(a.ex.category) - IL.CATEGORIES.indexOf(b.ex.category) || a.ex.name.localeCompare(b.ex.name));

  const addVariation = async (ex) => {
    const name = await IL.prompt({ title: 'New variation of ' + ex.name, placeholder: 'e.g. Paused, Deficit, Single-arm', confirmLabel: 'Add' });
    if (name) { IL.store.put('variations', { id: IL.uid(), exerciseId: ex.id, name, custom: true, archived: false, createdAt: Date.now() }); IL.toast('Variation added'); }
  };
  const renameVariation = async (v) => {
    const name = await IL.prompt({ title: 'Rename variation', value: v.name, confirmLabel: 'Save' });
    if (name) IL.store.put('variations', { ...v, name });
  };
  const deleteExercise = async (ex, vars) => {
    const ok = await IL.deleteVariations(s, vars.map((v) => v.id), ex.name);
    if (!ok) return;
    if (vars.some((v) => IL.variationHasHistory(s, v.id))) IL.store.put('exercises', { ...ex, archived: true });
    else IL.store.remove('exercises', ex.id);
  };
  const restore = (ex, v) => {
    IL.store.put('variations', { ...v, archived: false });
    if (ex.archived) IL.store.put('exercises', { ...ex, archived: false });
  };

  let lastCat = null;
  return html`<div className="page">
    <div className="page-head">
      <div><div className="sub">${s.variations.filter((v) => !v.archived).length} tracked variations</div><h1>Exercise library</h1></div>
      <button className="btn btn-primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${16} /> Custom exercise</button>
    </div>
    <div className="stack-sm">
      <input className="input" placeholder="Search exercises or variations" value=${q} onChange=${(e) => setQ(e.target.value)} />
      <div className="row between" style=${{ flexWrap: 'wrap', gap: 8 }}>
        <div className="chips">${['All', ...IL.CATEGORIES].map((c) => html`<button key=${c} className=${'chip' + (cat === c ? ' active' : '')} onClick=${() => setCat(c)}>${c}</button>`)}</div>
        <label className="row small muted" style=${{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked=${showArchived} onChange=${(e) => setShowArchived(e.target.checked)} /> Show deleted
        </label>
      </div>
    </div>

    <div className="stack mt">
      ${rows.length === 0 && html`<${IL.Empty}>No exercises found.<//>`}
      ${rows.map(({ ex, vars }) => {
        const head = cat === 'All' && ex.category !== lastCat ? html`<div className="label mt">${ex.category}</div>` : null;
        lastCat = ex.category;
        const isOpen = open[ex.id] || !!query;
        return html`<${React.Fragment} key=${ex.id}>${head}
          <div className="card tight">
            <div className="row">
              <button className="icon-btn sm" onClick=${() => setOpen({ ...open, [ex.id]: !open[ex.id] })} aria-label="Toggle variations">
                <${Icon} name=${isOpen ? 'chevronDown' : 'chevronRight'} size=${16} /></button>
              <div className="grow clickable" style=${{ borderRadius: 6 }} onClick=${() => setOpen({ ...open, [ex.id]: !open[ex.id] })}>
                <div style=${{ fontWeight: 600 }}>${ex.name} ${ex.custom && html`<span className="badge" style=${{ marginLeft: 6 }}>Custom</span>`}
                  ${ex.archived && html`<span className="badge danger" style=${{ marginLeft: 6 }}>Deleted</span>`}</div>
                <div className="tiny muted">${ex.category} · ${vars.length} variation${vars.length === 1 ? '' : 's'}</div>
              </div>
              <${IL.Menu} items=${[
                { label: 'Add variation', icon: 'plus', onClick: () => addVariation(ex) },
                { label: 'Edit exercise', icon: 'edit', onClick: () => setForm({ exercise: ex }) },
                { label: 'Delete exercise', icon: 'trash', danger: true, onClick: () => deleteExercise(ex, vars.filter((v) => !v.archived)) },
              ]} />
            </div>
            ${isOpen && html`<div className="list" style=${{ marginTop: 6, paddingLeft: 40 }}>
              ${vars.map((v) => {
                const r = IL.stats.records(s, v.id);
                return html`<div key=${v.id} className="list-item" style=${{ padding: '8px 0' }}>
                  <div className="grow clickable" style=${{ borderRadius: 6, padding: '2px 4px' }} onClick=${() => IL.nav('/exercise/' + v.id)}>
                    <div style=${{ fontWeight: 550 }}>${v.name} ${v.archived && html`<span className="badge danger">Deleted</span>`}</div>
                    <div className="tiny muted num">${r.sessions
                      ? `${r.sessions} session${r.sessions === 1 ? '' : 's'} · Best ${IL.fmt.w(r.maxWeight)} kg × ${r.maxWeightReps} · Last ${IL.fmt.dateShort(r.last.date)}`
                      : 'Not logged yet'}</div>
                  </div>
                  ${v.archived
                    ? html`<button className="btn btn-sm" onClick=${() => restore(ex, v)}>Restore</button>`
                    : html`<${IL.Menu} items=${[
                        { label: 'View progress', icon: 'chart', onClick: () => IL.nav('/exercise/' + v.id) },
                        { label: 'Rename variation', icon: 'edit', onClick: () => renameVariation(v) },
                        { label: 'Delete variation', icon: 'trash', danger: true, onClick: () => IL.deleteVariations(s, [v.id], v.name) },
                      ]} />`}
                </div>`;
              })}
              ${!ex.archived && html`<button className="btn btn-ghost btn-sm" style=${{ alignSelf: 'flex-start', marginTop: 4 }} onClick=${() => addVariation(ex)}>
                <${Icon} name="plus" size=${14} /> Add variation</button>`}
            </div>`}
          </div>
        <//>`;
      })}
    </div>
    ${form && html`<${IL.ExerciseForm} exercise=${form.exercise} initialCategory=${cat === 'All' ? 'Chest' : cat} onClose=${() => setForm(null)} />`}
  </div>`;
};

// ---------- Variation progress ----------
IL.ExerciseDetail = function ({ vid }) {
  const s = IL.useStore();
  const [metric, setMetric] = useState('weight');
  const v = IL.findVariation(s, vid);
  const d = IL.describeVariation(s, vid, findSnapshot(s, vid));
  const siblings = v ? s.variations.filter((x) => x.exerciseId === v.exerciseId && (!x.archived || x.id === vid)) : [];
  const hist = IL.stats.history(s, vid);
  const r = IL.stats.records(s, vid);

  // Flag points that set a new high for the selected metric.
  const key = { weight: 'topWeight', volume: 'volume', reps: 'maxReps', e1rm: 'e1rm' }[metric];
  let best = -Infinity;
  const points = hist.map((h, i) => {
    const y = h[key];
    const pr = i > 0 && y > best;
    best = Math.max(best, y);
    const tip = metric === 'weight' ? '× ' + h.topWeightReps + ' reps' : h.sets.length + ' sets';
    return { x: h.date, y: metric === 'e1rm' ? Math.round(y * 10) / 10 : y, pr, tip };
  });

  return html`<div className="page">
    <button className="btn btn-ghost btn-sm" onClick=${() => history.back()}><${Icon} name="chevronLeft" size=${14} /> Back</button>
    <div className="page-head mt">
      <div><div className="sub">${d.category}${d.archived ? ' · deleted from library' : ''}</div><h1>${d.name}</h1></div>
    </div>
    ${siblings.length > 1 && html`<div className="chips" style=${{ marginBottom: 18 }}>
      ${siblings.map((x) => html`<button key=${x.id} className=${'chip' + (x.id === vid ? ' active' : '')} onClick=${() => IL.nav('/exercise/' + x.id)}>${x.name}</button>`)}
    </div>`}

    <div className="grid grid-4">
      <div className="card stat"><div className="label">Heaviest</div>
        <div className="stat-value">${IL.fmt.w(r.maxWeight)}<span className="stat-unit">kg × ${r.maxWeightReps}</span></div>
        <div className="tiny muted">${r.maxWeightDate ? IL.fmt.date(r.maxWeightDate) : '—'}</div></div>
      <div className="card stat"><div className="label">Best reps</div>
        <div className="stat-value">${r.maxReps}<span className="stat-unit">reps</span></div>
        <div className="tiny muted">${r.maxRepsDate ? IL.fmt.date(r.maxRepsDate) : '—'}</div></div>
      <div className="card stat"><div className="label">Best session volume</div>
        <div className="stat-value">${IL.fmt.vol(r.bestVolume)}<span className="stat-unit">kg</span></div>
        <div className="tiny muted">${r.bestVolumeDate ? IL.fmt.date(r.bestVolumeDate) : '—'}</div></div>
      <div className="card stat"><div className="label">Est. 1RM</div>
        <div className="stat-value">${IL.fmt.w(Math.round(r.e1rm * 10) / 10)}<span className="stat-unit">kg</span></div>
        <div className="tiny muted">${r.sessions} sessions · ${IL.fmt.vol(r.totalVolume)} kg total</div></div>
    </div>

    <div className="card mt">
      <div className="card-head" style=${{ flexWrap: 'wrap' }}>
        <h2>${{ weight: 'Top set weight', volume: 'Volume per session', reps: 'Most reps in a set', e1rm: 'Estimated 1RM' }[metric]}</h2>
        <div className="seg">
          ${[['weight', 'Weight'], ['volume', 'Volume'], ['reps', 'Reps'], ['e1rm', '1RM']].map(([k, l]) => html`
            <button key=${k} className=${metric === k ? 'active' : ''} onClick=${() => setMetric(k)}>${l}</button>`)}
        </div>
      </div>
      <${IL.LineChart} points=${points} unit=${metric === 'reps' ? ' reps' : ' kg'} yFmt=${metric === 'volume' ? IL.fmt.vol : IL.fmt.w} zeroBased=${metric === 'volume'} />
      ${points.some((p) => p.pr) && html`<div className="tiny muted" style=${{ marginTop: 6 }}><span style=${{ color: 'var(--pr)' }}>●</span> New personal best</div>`}
    </div>

    <div className="card mt">
      <div className="card-head"><h2>Session history</h2></div>
      ${hist.length === 0 ? html`<${IL.Empty}>Log this variation in a workout to start tracking it.<//>` : html`
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Date</th><th>Sets</th><th style=${{ textAlign: 'right' }}>Top set</th><th style=${{ textAlign: 'right' }}>Volume</th></tr></thead>
        <tbody>${hist.slice().reverse().map((h) => html`
          <tr key=${h.session.id} className="clickable" onClick=${() => IL.nav('/history/' + h.session.id)}>
            <td style=${{ whiteSpace: 'nowrap' }}>${IL.fmt.dateShort(h.date)}</td>
            <td className="text-2 small">${h.sets.map((x) => IL.fmt.w(x.weight) + '×' + x.reps).join(', ')}</td>
            <td style=${{ textAlign: 'right', whiteSpace: 'nowrap' }}>${IL.fmt.w(h.topWeight)} × ${h.topWeightReps}</td>
            <td style=${{ textAlign: 'right' }}>${IL.fmt.int(h.volume)}</td>
          </tr>`)}</tbody>
      </table></div>`}
    </div>
  </div>`;
};

function findSnapshot(s, vid) {
  for (const sess of s.sessions) { const e = sess.entries.find((x) => x.variationId === vid); if (e) return e; }
  return null;
}
