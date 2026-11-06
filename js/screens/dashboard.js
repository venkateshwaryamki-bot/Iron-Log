window.IL = window.IL || {};

IL.startWorkout = async function (s, plan, dayIdx) {
  const active = IL.activeSession(s);
  if (active) {
    const ok = await IL.confirm({ title: 'Workout in progress', message: `“${active.name}” is still running. Resume it instead?`, confirmLabel: 'Resume' });
    if (ok) IL.nav('/workout');
    return;
  }
  IL.startSession(s, plan, dayIdx);
  IL.nav('/workout');
};

IL.WeekStrip = function ({ s, plan, selected, onSelect }) {
  const weekStart = IL.time.startOfWeek(Date.now());
  const sessions = IL.stats.inRange(s, weekStart, IL.time.addDays(weekStart, 7));
  return html`<div className="week">
    ${IL.DAY_SHORT.map((label, i) => {
      const ts = IL.time.addDays(weekStart, i);
      const day = plan ? plan.days[i] : null;
      const done = sessions.some((x) => IL.time.sameDay(x.startedAt, ts));
      const today = IL.time.sameDay(ts, Date.now());
      return html`<button key=${i} className=${'day' + (today ? ' today' : '') + (selected === i ? ' selected' : '')} onClick=${() => onSelect(i)}>
        <span className="day-dow">${label}</span>
        <span className="day-date">${new Date(ts).getDate()}</span>
        <span className="day-name">${day ? (day.rest ? 'Rest' : day.name) : '—'}</span>
        <span className=${'day-status' + (done ? ' done' : day && day.rest ? ' rest' : '')} title=${done ? 'Completed' : day && day.rest ? 'Rest day' : 'Not done'} />
      </button>`;
    })}
  </div>`;
};

IL.Dashboard = function () {
  const s = IL.useStore();
  const plan = IL.activePlan(s);
  const todayIdx = IL.time.dayIdx(Date.now());
  const [sel, setSel] = useState(todayIdx);
  const active = IL.activeSession(s);

  const weekStart = IL.time.startOfWeek(Date.now());
  const weekSessions = IL.stats.inRange(s, weekStart, IL.time.addDays(weekStart, 7));
  const weekVolume = weekSessions.reduce((a, x) => a + IL.stats.sessionTotals(x).volume, 0);
  const planned = plan ? plan.days.filter((d) => !d.rest).length : 0;
  const doneDays = new Set(weekSessions.map((x) => IL.time.startOfDay(x.startedAt))).size;
  const streak = IL.stats.streak(s, plan);
  const last = IL.doneSessions(s)[0];
  const lastT = last && IL.stats.sessionTotals(last);

  const day = plan ? plan.days[sel] : null;
  const selTs = IL.time.addDays(weekStart, sel);
  const doneOnSel = weekSessions.find((x) => IL.time.sameDay(x.startedAt, selTs));
  const hour = new Date().getHours();

  return html`<div className="page">
    <div className="page-head">
      <div>
        <div className="sub">${IL.fmt.weekday(Date.now())}</div>
        <h1>${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}</h1>
      </div>
      ${active
        ? html`<button className="btn btn-primary btn-lg" onClick=${() => IL.nav('/workout')}><${Icon} name="play" size=${16} /> Resume workout</button>`
        : html`<button className="btn btn-primary btn-lg" onClick=${() => IL.startWorkout(s, plan, todayIdx)}><${Icon} name="play" size=${16} />
            ${plan && !plan.days[todayIdx].rest && !weekSessions.some((x) => IL.time.sameDay(x.startedAt, Date.now())) ? 'Start today’s workout' : 'Quick start'}</button>`}
    </div>

    <div className="grid grid-4">
      <div className="card stat">
        <div className="label">This week</div>
        <div className="stat-value">${doneDays}<span className="stat-unit">/ ${planned} days</span></div>
        <div className="progress"><div style=${{ width: Math.min(100, planned ? (doneDays / planned) * 100 : 0) + '%' }} /></div>
      </div>
      <div className="card stat">
        <div className="label">Week volume</div>
        <div className="stat-value">${IL.fmt.vol(weekVolume)}<span className="stat-unit">kg</span></div>
        <div className="tiny muted mt">${weekSessions.length} workout${weekSessions.length === 1 ? '' : 's'} logged</div>
      </div>
      <div className="card stat">
        <div className="label">Streak</div>
        <div className="stat-value">${streak}<span className="stat-unit">day${streak === 1 ? '' : 's'}</span></div>
        <div className="tiny muted mt">Rest days don’t break it</div>
      </div>
      <div className="card stat clickable" onClick=${() => last && IL.nav('/history/' + last.id)}>
        <div className="label">Last workout</div>
        ${last ? html`
          <div style=${{ fontWeight: 650, marginTop: 6 }} className="ellipsis">${last.name}</div>
          <div className="tiny muted">${IL.fmt.dateShort(last.startedAt)} · ${lastT.sets} sets · ${IL.fmt.vol(lastT.volume)} kg · ${IL.fmt.duration(lastT.duration)}</div>`
        : html`<div className="muted small" style=${{ marginTop: 6 }}>Nothing logged yet</div>`}
      </div>
    </div>

    <div className="card mt-lg">
      <div className="card-head">
        <h2>This week</h2>
        <button className="btn btn-sm btn-ghost" onClick=${() => IL.nav('/plan')}>${plan ? plan.name : 'No plan'} <${Icon} name="chevronRight" size=${14} /></button>
      </div>
      ${plan ? html`<${IL.WeekStrip} s=${s} plan=${plan} selected=${sel} onSelect=${setSel} />` : html`<${IL.Empty}>Create a plan to see your week.<//>`}

      ${day && html`<div className="mt-lg">
        <div className="row between" style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="label">${sel === todayIdx ? 'Today' : IL.DAY_NAMES[sel]}</div>
            <h2 style=${{ marginTop: 4 }}>${day.rest ? 'Rest day' : day.name}</h2>
            ${!day.rest && html`<div className="sub">${day.items.length} exercises · ${day.items.reduce((a, it) => a + (Number(it.sets) || 0), 0)} sets</div>`}
          </div>
          <div className="row-wrap">
            ${doneOnSel && html`<span className="badge accent"><${Icon} name="check" size=${13} /> Completed</span>`}
            ${!day.rest && !active && html`<button className="btn" onClick=${() => IL.startWorkout(s, plan, sel)}><${Icon} name="play" size=${14} /> Start ${sel === todayIdx ? '' : IL.DAY_SHORT[sel]}</button>`}
          </div>
        </div>
        ${day.rest
          ? html`<p className="muted small">Recovery is part of the program. You can still start a freestyle workout.</p>`
          : html`<div className="list mt">
            ${day.items.map((it, i) => {
              const d = IL.describeVariation(s, it.variationId);
              const prev = IL.stats.previousEntry(s, it.variationId, Date.now(), null);
              const top = prev && IL.stats.doneSets(prev.entry).reduce((m, x) => (Number(x.weight) > Number(m.weight) ? x : m), { weight: 0, reps: 0 });
              return html`<div key=${it.id} className="list-item clickable" style=${{ padding: '10px 6px' }} onClick=${() => IL.nav('/exercise/' + it.variationId)}>
                <span className="muted num small" style=${{ width: 18 }}>${i + 1}</span>
                <div className="grow"><div className="ellipsis" style=${{ fontWeight: 550 }}>${d.name}</div><div className="tiny muted">${d.category}</div></div>
                <div className="small text-2 num">${it.sets} × ${it.reps}</div>
                <div className="tiny muted num" style=${{ width: 90, textAlign: 'right' }}>${top ? 'Last ' + IL.fmt.w(top.weight) + '×' + top.reps : 'New'}</div>
              </div>`;
            })}
          </div>`}
      </div>`}
    </div>
  </div>`;
};
