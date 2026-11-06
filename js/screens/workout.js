// Workout logging. Every change writes the session straight to IndexedDB (autosave).
// The same editor is used for a live session and for editing a finished one from History.
window.IL = window.IL || {};

IL.Workout = function () {
  const s = IL.useStore();
  const active = IL.activeSession(s);
  const [summaryId, setSummaryId] = useState(null);
  const summary = summaryId && s.sessions.find((x) => x.id === summaryId);

  return html`<${React.Fragment}>
    ${active ? html`<${IL.SessionEditor} key=${active.id} sessionId=${active.id} mode="live" onFinished=${setSummaryId} />` : html`<${StartChooser} s=${s} />`}
    ${summary && html`<${FinishSummary} s=${s} session=${summary} onClose=${() => setSummaryId(null)} />`}
  <//>`;
};

function StartChooser({ s }) {
  const plan = IL.activePlan(s);
  const todayIdx = IL.time.dayIdx(Date.now());
  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (todayIdx + i) % 7);
  return html`<div className="page page-narrow">
    <div className="page-head"><div><div className="sub">${plan ? plan.name : 'No active plan'}</div><h1>Start a workout</h1></div></div>
    <div className="stack">
      ${plan && order.map((i) => {
        const d = plan.days[i];
        if (d.rest && i !== todayIdx) return null;
        return html`<div key=${i} className="card tight row" style=${i === todayIdx ? { borderColor: 'var(--accent)' } : null}>
          <div className="grow">
            <div className="label" style=${i === todayIdx ? { color: 'var(--accent)' } : null}>${i === todayIdx ? 'Today · ' : ''}${IL.DAY_NAMES[i]}</div>
            <div style=${{ fontWeight: 650, fontSize: 16, marginTop: 2 }}>${d.rest ? 'Rest day' : d.name}</div>
            ${!d.rest && html`<div className="tiny muted ellipsis">${d.items.map((it) => IL.describeVariation(s, it.variationId).name).join(' · ') || 'No exercises yet'}</div>`}
          </div>
          ${!d.rest && html`<button className=${'btn ' + (i === todayIdx ? 'btn-primary btn-lg' : '')} onClick=${() => IL.startWorkout(s, plan, i)}>
            <${Icon} name="play" size=${15} /> Start</button>`}
        </div>`;
      })}
      <div className="card tight row">
        <div className="grow"><div style=${{ fontWeight: 650 }}>Freestyle workout</div><div className="tiny muted">Start empty and add exercises as you go</div></div>
        <button className="btn" onClick=${() => IL.startWorkout(s, null, null)}><${Icon} name="plus" size=${15} /> Empty</button>
      </div>
    </div>
  </div>`;
}

IL.SessionEditor = function ({ sessionId, mode, onFinished }) {
  const s = IL.useStore();
  const session = s.sessions.find((x) => x.id === sessionId);
  const [now, setNow] = useState(Date.now());
  const [picker, setPicker] = useState(null); // { swapIdx? }
  const [notesOpen, setNotesOpen] = useState({});
  useEffect(() => {
    if (mode !== 'live') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [mode]);
  IL.useWakeLock(mode === 'live');

  // Rest timer: buzz once when it runs out.
  const restLeft = session && session.restUntil ? session.restUntil - now : 0;
  useEffect(() => {
    if (session && session.restUntil && restLeft <= 0) {
      IL.buzz([250, 120, 250]);
      IL.store.put('sessions', { ...IL.store.get().sessions.find((x) => x.id === sessionId), restUntil: null });
    }
  }, [restLeft <= 0]);

  if (!session) return html`<div className="page"><${IL.Empty}>Workout not found.<//></div>`;

  // Read the latest stored copy so back-to-back edits never overwrite each other.
  const update = (fn) => {
    const cur = IL.store.get().sessions.find((x) => x.id === sessionId) || session;
    const next = JSON.parse(JSON.stringify(cur)); fn(next); IL.store.put('sessions', next); return next;
  };
  const prs = IL.stats.sessionPRs(s, session);
  const totals = IL.stats.sessionTotals(session);
  const live = mode === 'live';

  const restSecs = IL.settings(s).restSeconds == null ? 90 : IL.settings(s).restSeconds;
  const toggleDone = (ei, si) => {
    const next = update((x) => {
      const st = x.entries[ei].sets[si];
      st.done = !st.done;
      if (live && st.done && restSecs > 0) x.restUntil = Date.now() + restSecs * 1000;
    });
    const st = next.entries[ei].sets[si];
    if (st.done) {
      const kind = IL.stats.sessionPRs(IL.store.get(), next).sets[st.id];
      if (kind) {
        IL.buzz([60, 60, 60, 60, 120]);
        IL.toast((kind === 'weight' ? 'New weight PR · ' : 'New rep PR · ') + IL.fmt.w(st.weight) + ' kg × ' + st.reps, 'pr');
      } else IL.buzz(25);
    }
  };
  const addSet = (ei) => update((x) => {
    const sets = x.entries[ei].sets;
    const last = sets[sets.length - 1];
    sets.push({ id: IL.uid(), weight: last ? last.weight : 0, reps: last ? last.reps : 10, done: false });
  });
  const onPick = (vid) => {
    if (picker.swapIdx != null) {
      const d = IL.describeVariation(s, vid);
      update((x) => Object.assign(x.entries[picker.swapIdx], { variationId: vid, exName: d.exName, varName: d.varName, category: d.category }));
      IL.toast('Switched to ' + d.name);
    } else {
      update((x) => x.entries.push(IL.makeEntry(s, vid, 3, 10, session.startedAt)));
    }
    setPicker(null);
  };

  const finish = async () => {
    const pending = session.entries.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter((st) => !st.done).length), 0);
    const ok = await IL.confirm({
      title: 'Finish workout?',
      message: totals.sets === 0 ? 'No sets are marked complete yet. Finish anyway?'
        : pending ? `${pending} set${pending === 1 ? ' isn’t' : 's aren’t'} marked complete and won’t count toward volume or PRs.` : 'Nice work. Save this session to your history.',
      confirmLabel: 'Finish',
    });
    if (!ok) return;
    update((x) => { x.status = 'done'; x.finishedAt = Date.now(); x.restUntil = null; });
    onFinished && onFinished(session.id);
  };
  const discard = async () => {
    if (await IL.confirm({ title: 'Discard workout?', message: 'This session and all its sets will be deleted.', confirmLabel: 'Discard', danger: true })) {
      IL.store.remove('sessions', session.id);
      IL.nav('/dashboard');
    }
  };

  const toLocalInput = (ts) => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  return html`<div className="page page-narrow">
    <div className="session-bar">
      <div className="row between">
        <div className="grow">
          <input className="day-name-input" style=${{ fontSize: 20, fontWeight: 700, padding: '2px 4px', marginLeft: -4, width: '100%' }}
            value=${session.name} aria-label="Workout name" onChange=${(e) => update((x) => { x.name = e.target.value; })} />
          <div className="row small muted" style=${{ gap: 8 }}>
            ${live ? html`<span className="timer">${IL.fmt.clock(now - session.startedAt)}</span>` : html`<span>${IL.fmt.date(session.startedAt)}</span>`}
            <span>·</span><span className="num">${totals.sets} sets</span><span>·</span><span className="num">${IL.fmt.int(totals.volume)} kg</span>
            <span className="saved-ind">· autosaved</span>
          </div>
        </div>
        ${live ? html`<button className="btn btn-primary btn-lg" onClick=${finish}><${Icon} name="check" size=${16} /> Finish</button>`
          : html`<button className="btn btn-primary" onClick=${() => IL.nav('/history/' + session.id)}>Done</button>`}
      </div>
    </div>

    ${!live && html`<div className="card tight grid grid-2" style=${{ marginBottom: 14 }}>
      <label className="field"><span>Started</span>
        <input type="datetime-local" className="input" value=${toLocalInput(session.startedAt)}
          onChange=${(e) => { const t = new Date(e.target.value).getTime(); if (!isNaN(t)) update((x) => { const dur = x.finishedAt - x.startedAt; x.startedAt = t; x.finishedAt = t + dur; }); }} /></label>
      <label className="field"><span>Duration (minutes)</span>
        <input className="input" inputMode="numeric" value=${Math.round((session.finishedAt - session.startedAt) / 60000)}
          onChange=${(e) => { const m = parseInt(e.target.value); if (m >= 0) update((x) => { x.finishedAt = x.startedAt + m * 60000; }); }} /></label>
    </div>`}

    <div className="stack">
      ${session.entries.length === 0 && html`<div className="card"><${IL.Empty}>No exercises yet. Add one to start logging.<//></div>`}
      ${session.entries.map((e, ei) => {
        const d = IL.describeVariation(s, e.variationId, e);
        const prev = IL.stats.previousEntry(s, e.variationId, session.startedAt, session.id);
        const prevSets = prev ? IL.stats.doneSets(prev.entry) : [];
        const rec = IL.stats.records(s, e.variationId);
        const showNotes = notesOpen[e.id] || e.notes;
        return html`<div key=${e.id} className=${'card ex-card' + (e.skipped ? ' skipped' : '')}>
          <div className="ex-card-head">
            <div className="grow">
              <div className="row" style=${{ gap: 8, flexWrap: 'wrap' }}>
                <span className="ex-title" onClick=${() => IL.nav('/exercise/' + e.variationId)}>${d.name}</span>
                ${e.skipped && html`<span className="badge">Skipped</span>`}
                ${prs.volume[e.id] && html`<span className="badge pr"><${Icon} name="trophy" size=${12} /> Volume PR</span>`}
              </div>
              <div className="prev-line num">
                ${prev ? html`Last ${IL.fmt.dateShort(prev.session.startedAt)}: ${prevSets.map((x) => IL.fmt.w(x.weight) + '×' + x.reps).join(' · ')}` : 'First time logging this variation'}
                ${rec.sessions > 0 && html` · Best ${IL.fmt.w(rec.maxWeight)} kg`}
              </div>
            </div>
            <${IL.Menu} items=${[
              { label: showNotes ? 'Hide notes' : 'Add note', icon: 'note', onClick: () => setNotesOpen({ ...notesOpen, [e.id]: !notesOpen[e.id] }) },
              { label: 'Swap variation / exercise', icon: 'swap', onClick: () => setPicker({ swapIdx: ei }) },
              ei > 0 && { label: 'Move up', icon: 'up', onClick: () => update((x) => { const [it] = x.entries.splice(ei, 1); x.entries.splice(ei - 1, 0, it); }) },
              ei < session.entries.length - 1 && { label: 'Move down', icon: 'down', onClick: () => update((x) => { const [it] = x.entries.splice(ei, 1); x.entries.splice(ei + 1, 0, it); }) },
              { label: e.skipped ? 'Unskip exercise' : 'Skip exercise', icon: 'skip', onClick: () => update((x) => { x.entries[ei].skipped = !x.entries[ei].skipped; }) },
              { label: 'Remove from workout', icon: 'trash', danger: true, onClick: () => update((x) => { x.entries.splice(ei, 1); }) },
            ]} />
          </div>
          ${!e.skipped && html`
            <div style=${{ padding: '0 8px' }}>
              <table className="set-table">
                <thead><tr><th>Set</th><th className="col-prev">Previous</th><th>kg</th><th>Reps</th><th><span className="sr">Done</span></th><th></th></tr></thead>
                <tbody>
                  ${e.sets.map((st, si) => {
                    const p = prevSets[si];
                    const pr = prs.sets[st.id];
                    return html`<tr key=${st.id} className=${'set-row' + (st.done ? ' done' : '')}>
                      <td className="set-num">${si + 1}${pr && html`<span className="pr-flag">PR</span>`}</td>
                      <td className="set-prev col-prev">${p ? IL.fmt.w(p.weight) + ' × ' + p.reps : '—'}</td>
                      <td><${IL.Stepper} label=${'Set ' + (si + 1) + ' weight'} value=${st.weight} step=${2.5}
                        onChange=${(v) => update((x) => { x.entries[ei].sets[si].weight = v; })} /></td>
                      <td><${IL.Stepper} label=${'Set ' + (si + 1) + ' reps'} value=${st.reps} step=${1} decimals=${false}
                        onChange=${(v) => update((x) => { x.entries[ei].sets[si].reps = v; })} /></td>
                      <td><button className=${'check-btn' + (st.done ? ' on' : '')} aria-label=${st.done ? 'Mark set incomplete' : 'Mark set complete'}
                        onClick=${() => toggleDone(ei, si)}><${Icon} name="check" size=${20} stroke=${2.4} /></button></td>
                      <td style=${{ width: 30 }}><button className="icon-btn sm" aria-label="Delete set"
                        onClick=${() => update((x) => { x.entries[ei].sets.splice(si, 1); })}><${Icon} name="x" size=${15} /></button></td>
                    </tr>`;
                  })}
                </tbody>
              </table>
            </div>`}
          <div className="ex-foot">
            ${!e.skipped && html`<button className="btn" onClick=${() => addSet(ei)}><${Icon} name="plus" size=${15} /> Add set</button>`}
            ${!showNotes && html`<button className="btn btn-ghost" onClick=${() => setNotesOpen({ ...notesOpen, [e.id]: true })}><${Icon} name="note" size=${15} /> Note</button>`}
            <span className="grow" />
            <span className="small muted num">${IL.fmt.int(IL.stats.entryVolume(e))} kg</span>
            ${showNotes && html`<textarea className="textarea" style=${{ minHeight: 56 }} placeholder="Notes for this exercise (seat height, grip, how it felt…)"
              value=${e.notes} onChange=${(ev) => update((x) => { x.entries[ei].notes = ev.target.value; })} />`}
          </div>
        </div>`;
      })}

      <button className="btn btn-lg btn-block" onClick=${() => setPicker({})}><${Icon} name="plus" size=${16} /> Add exercise</button>

      <div className="card tight">
        <label className="field"><span>Workout notes</span>
          <textarea className="textarea" placeholder="Energy, sleep, anything worth remembering…" value=${session.notes}
            onChange=${(e) => update((x) => { x.notes = e.target.value; })} /></label>
      </div>

      ${live && html`<div className="row between">
        <button className="btn btn-ghost btn-danger" onClick=${discard}><${Icon} name="trash" size=${15} /> Discard workout</button>
        <button className="btn btn-primary btn-lg" onClick=${finish}><${Icon} name="check" size=${16} /> Finish workout</button>
      </div>`}
    </div>

    ${live && restLeft > 0 && html`<div className="rest-bar" role="timer" aria-live="off">
      <div className="rest-progress" style=${{ width: Math.min(100, (restLeft / (restSecs * 1000 || 1)) * 100) + '%' }} />
      <div className="label" style=${{ color: 'inherit' }}>Rest</div>
      <div className="rest-time num">${IL.fmt.clock(restLeft + 999)}</div>
      <span className="grow" />
      <button className="btn btn-sm" onClick=${() => update((x) => { x.restUntil = Math.max(Date.now() + 1000, x.restUntil - 15000); })}>−15s</button>
      <button className="btn btn-sm" onClick=${() => update((x) => { x.restUntil += 15000; })}>+15s</button>
      <button className="btn btn-sm btn-primary" onClick=${() => update((x) => { x.restUntil = null; })}>Skip</button>
    </div>`}

    ${picker && html`<${IL.ExercisePicker} title=${picker.swapIdx != null ? 'Swap exercise' : 'Add exercise'} onClose=${() => setPicker(null)} onPick=${onPick} />`}
  </div>`;
};

// Keep the screen on during a live workout (re-acquired when the app comes back to the foreground).
IL.useWakeLock = function (enabled) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock = null, alive = true;
    const acquire = async () => {
      try { if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch (e) { /* denied or unsupported */ }
      if (!alive && lock) lock.release();
    };
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); if (lock) lock.release().catch(() => {}); };
  }, [enabled]);
};

IL.buzz = (pattern) => {
  if (IL.settings(IL.store.get()).haptics === false) return;
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) { /* ignore */ }
};

function FinishSummary({ s, session, onClose }) {
  const t = IL.stats.sessionTotals(session);
  const prs = IL.stats.sessionPRs(s, session);
  return html`<${IL.Modal} title="Workout complete" onClose=${onClose}
    footer=${html`<button className="btn" onClick=${() => { onClose(); IL.nav('/history/' + session.id); }}>View details</button>
      <button className="btn btn-primary" onClick=${() => { onClose(); IL.nav('/dashboard'); }}>Done</button>`}>
    <h2 style=${{ marginBottom: 14 }}>${session.name}</h2>
    <div className="grid grid-2">
      <div><div className="label">Duration</div><div className="stat-value num" style=${{ fontSize: 22, fontWeight: 700 }}>${IL.fmt.duration(t.duration)}</div></div>
      <div><div className="label">Volume</div><div className="num" style=${{ fontSize: 22, fontWeight: 700 }}>${IL.fmt.int(t.volume)} kg</div></div>
      <div><div className="label">Sets</div><div className="num" style=${{ fontSize: 22, fontWeight: 700 }}>${t.sets}</div></div>
      <div><div className="label">Reps</div><div className="num" style=${{ fontSize: 22, fontWeight: 700 }}>${t.reps}</div></div>
    </div>
    ${prs.list.length > 0 && html`<div className="mt-lg">
      <div className="label" style=${{ color: 'var(--pr)' }}>${prs.list.length} personal record${prs.list.length === 1 ? '' : 's'}</div>
      <div className="list">${prs.list.map((p, i) => html`<div key=${i} className="list-item" style=${{ padding: '8px 0' }}>
        <${Icon} name="trophy" size=${16} />
        <div className="grow ellipsis">${IL.describeVariation(s, p.entry.variationId, p.entry).name}</div>
        <span className="badge pr">${p.kind}</span><span className="small num">${p.value}</span>
      </div>`)}</div>
    </div>`}
  <//>`;
}
