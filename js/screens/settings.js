window.IL = window.IL || {};

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

IL.exportJSON = (s) => {
  const data = { app: 'ironlog', version: 1, exportedAt: new Date().toISOString() };
  IL.db.STORES.forEach((k) => { data[k] = s[k]; });
  download('ironlog-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json');
};

IL.exportCSV = (s) => {
  const q = (v) => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const rows = [['date', 'workout', 'exercise', 'variation', 'category', 'set', 'weight_kg', 'reps', 'completed', 'volume_kg', 'exercise_notes', 'workout_notes', 'duration_min']];
  IL.doneSessions(s).slice().reverse().forEach((x) => {
    const dur = x.finishedAt ? Math.round((x.finishedAt - x.startedAt) / 60000) : '';
    x.entries.forEach((e) => {
      const d = IL.describeVariation(s, e.variationId, e);
      e.sets.forEach((st, i) => rows.push([new Date(x.startedAt).toISOString(), x.name, d.exName, d.varName, d.category, i + 1, st.weight, st.reps,
        st.done && !e.skipped ? 'yes' : 'no', st.done && !e.skipped ? st.weight * st.reps : 0, e.notes, x.notes, dur]));
    });
  });
  download('ironlog-sets-' + new Date().toISOString().slice(0, 10) + '.csv', rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
};

IL.Settings = function () {
  const s = IL.useStore();
  const settings = IL.settings(s);
  const fileRef = useRef(null);
  const installPrompt = IL.useInstallPrompt();
  const rest = settings.restSeconds == null ? 90 : settings.restSeconds;
  const totalSets = s.sessions.reduce((a, x) => a + x.entries.reduce((b, e) => b + e.sets.length, 0), 0);

  const onImport = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'ironlog' || !Array.isArray(data.sessions) || !Array.isArray(data.variations)) throw new Error('Not an Ironlog backup file.');
      const ok = await IL.confirm({ title: 'Restore backup?', danger: true, confirmLabel: 'Replace my data',
        message: `This replaces everything on this device with the backup from ${data.exportedAt ? IL.fmt.date(data.exportedAt) : 'the file'} (${data.sessions.length} workouts). Export first if unsure.` });
      if (!ok) return;
      const clean = {};
      IL.db.STORES.forEach((k) => { clean[k] = Array.isArray(data[k]) ? data[k] : []; });
      await IL.store.replaceAll(clean);
      IL.toast('Backup restored');
    } catch (err) { alert('Import failed: ' + err.message); }
  };

  const reset = async () => {
    if (!await IL.confirm({ title: 'Erase all data?', danger: true, confirmLabel: 'Erase everything',
      message: 'Deletes all workouts, plans and custom exercises on this device and restores the starter library. This cannot be undone.' })) return;
    await IL.store.reset();
    IL.toast('All data erased');
    IL.nav('/dashboard');
  };

  return html`<div className="page page-narrow">
    <div className="page-head"><h1>Settings</h1></div>
    <div className="stack">
      ${!IL.isStandalone() && html`<div className="card">
        <div className="card-head"><h2>Install on your phone</h2></div>
        ${installPrompt
          ? html`<div className="row between"><div className="small muted">Adds Ironlog to your home screen. It opens full screen and works offline.</div>
              <button className="btn btn-primary" onClick=${async () => { installPrompt.prompt(); await installPrompt.userChoice; IL.install.prompt = null; IL.install.listeners.forEach((l) => l()); }}>
                <${Icon} name="download" size=${15} /> Install app</button></div>`
          : html`<div className="small muted">On Android, open Chrome's <b>⋮</b> menu and tap <b>Add to Home screen</b> or <b>Install app</b>. On iPhone, tap Share, then <b>Add to Home Screen</b>.</div>`}
      </div>`}

      <div className="card">
        <div className="card-head"><h2>Workout</h2></div>
        <div className="row between" style=${{ flexWrap: 'wrap', gap: 10 }}>
          <div><div>Rest timer</div><div className="tiny muted">Starts after each completed set</div></div>
          <div className="seg">${[[0, 'Off'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00']].map(([v, l]) => html`
            <button key=${v} className=${rest === v ? 'active' : ''} onClick=${() => IL.updateSettings({ restSeconds: v })}>${l}</button>`)}</div>
        </div>
        <div className="divider" />
        <div className="row between">
          <div><div>Vibration</div><div className="tiny muted">On set complete, PRs and when rest ends</div></div>
          <div className="seg">${[[true, 'On'], [false, 'Off']].map(([v, l]) => html`
            <button key=${l} className=${(settings.haptics !== false) === v ? 'active' : ''} onClick=${() => IL.updateSettings({ haptics: v })}>${l}</button>`)}</div>
        </div>
        <div className="divider" />
        <div className="small muted">The screen stays on while a workout is running.</div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Appearance</h2></div>
        <div className="row between">
          <div><div>Theme</div><div className="tiny muted">Dark is the default</div></div>
          <div className="seg">${[['dark', 'Dark'], ['light', 'Light']].map(([k, l]) => html`
            <button key=${k} className=${settings.theme === k ? 'active' : ''} onClick=${() => IL.updateSettings({ theme: k })}>${l}</button>`)}</div>
        </div>
        <div className="divider" />
        <div className="row between"><div><div>Units</div><div className="tiny muted">Weights are recorded in kilograms</div></div><span className="badge">kg</span></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Backup & export</h2></div>
        <p className="small muted" style=${{ marginTop: 0 }}>Data is stored on this device in your browser (IndexedDB) and works offline. Export a backup regularly — clearing browser data deletes it.</p>
        <div className="small text-2 num" style=${{ marginBottom: 12 }}>${IL.doneSessions(s).length} workouts · ${totalSets} sets · ${s.plans.length} plans · ${s.variations.length} variations</div>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick=${() => IL.exportJSON(s)}><${Icon} name="download" size=${15} /> Full backup (JSON)</button>
          <button className="btn" onClick=${() => IL.exportCSV(s)}><${Icon} name="download" size=${15} /> Sets (CSV)</button>
          <button className="btn" onClick=${() => fileRef.current.click()}><${Icon} name="upload" size=${15} /> Restore backup</button>
          <input type="file" accept="application/json,.json" ref=${fileRef} style=${{ display: 'none' }} onChange=${onImport} />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Danger zone</h2></div>
        <div className="row between"><div className="small muted">Erase everything and start fresh.</div>
          <button className="btn btn-danger" onClick=${reset}><${Icon} name="trash" size=${15} /> Erase all data</button></div>
      </div>
    </div>
  </div>`;
};
