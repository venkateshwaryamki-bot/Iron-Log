// Weekly planner. Plans only reference variations by id; editing a plan never touches session history.
window.IL = window.IL || {};

const clone = (x) => JSON.parse(JSON.stringify(x));

IL.Planner = function () {
  const s = IL.useStore();
  const active = IL.activePlan(s);
  const [planId, setPlanId] = useState(active && active.id);
  const plan = s.plans.find((p) => p.id === planId) || active;
  const [picker, setPicker] = useState(null); // { day, replaceIdx? }
  const [copyFrom, setCopyFrom] = useState(null);
  const drag = useRef(null);
  const [over, setOver] = useState(null);

  if (!plan) return html`<div className="page"><${IL.Empty}>No plans.
    <div className="mt"><button className="btn btn-primary" onClick=${() => newPlan()}>Create plan</button></div><//></div>`;

  const save = (p) => IL.store.put('plans', p);
  const fresh = () => IL.store.get().plans.find((p) => p.id === plan.id) || plan;
  const setDay = (i, patch) => { const p = clone(fresh()); p.days[i] = { ...p.days[i], ...patch }; save(p); };
  const setItem = (di, ii, patch) => { const p = clone(fresh()); Object.assign(p.days[di].items[ii], patch); save(p); };

  const move = (fromDay, fromIdx, toDay, toIdx) => {
    const p = clone(fresh());
    const [it] = p.days[fromDay].items.splice(fromIdx, 1);
    if (fromDay === toDay && toIdx > fromIdx) toIdx--;
    p.days[toDay].items.splice(toIdx, 0, it);
    if (p.days[toDay].rest) { p.days[toDay].rest = false; if (p.days[toDay].name === 'Rest') p.days[toDay].name = 'Workout'; }
    save(p);
  };

  async function newPlan() {
    const name = await IL.prompt({ title: 'New plan', placeholder: 'e.g. Push / Pull / Legs', confirmLabel: 'Create' });
    if (!name) return;
    const p = { id: IL.uid(), name, createdAt: Date.now(), days: IL.newPlanDays() };
    IL.store.put('plans', p); setPlanId(p.id);
    if (!active) IL.updateSettings({ activePlanId: p.id });
  }
  const duplicate = async () => {
    const name = await IL.prompt({ title: 'Duplicate plan', value: plan.name + ' (copy)', confirmLabel: 'Duplicate' });
    if (!name) return;
    const p = clone(fresh());
    p.id = IL.uid(); p.name = name; p.createdAt = Date.now();
    p.days.forEach((d) => d.items.forEach((it) => { it.id = IL.uid(); }));
    save(p); setPlanId(p.id); IL.toast('Plan duplicated');
  };
  const rename = async () => {
    const name = await IL.prompt({ title: 'Rename plan', value: plan.name, confirmLabel: 'Rename' });
    if (name) save({ ...plan, name });
  };
  const del = async () => {
    if (s.plans.length < 2) return IL.toast('Keep at least one plan');
    const ok = await IL.confirm({ title: 'Delete plan?', message: `“${plan.name}” will be deleted. Your workout history is kept.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    IL.store.remove('plans', plan.id);
    const next = s.plans.find((p) => p.id !== plan.id);
    if (active && active.id === plan.id) IL.updateSettings({ activePlanId: next.id });
    setPlanId(next.id);
  };

  const onPick = (vid) => {
    const { day, replaceIdx } = picker;
    const p = clone(fresh());
    const d = p.days[day];
    if (replaceIdx != null) d.items[replaceIdx].variationId = vid;
    else {
      d.items.push({ id: IL.uid(), variationId: vid, sets: 3, reps: 10 });
      if (d.rest) { d.rest = false; if (d.name === 'Rest') d.name = 'Workout'; }
    }
    save(p);
    setPicker(null);
    IL.toast(replaceIdx != null ? 'Variation swapped' : 'Exercise added');
  };

  const isActive = active && active.id === plan.id;
  const todayIdx = IL.time.dayIdx(Date.now());

  return html`<div className="page">
    <div className="page-head">
      <div><div className="sub">Weekly plan</div><h1>${plan.name}</h1></div>
      <div className="row-wrap">
        <select className="select" style=${{ width: 'auto', minWidth: 160 }} value=${plan.id} onChange=${(e) => setPlanId(e.target.value)}>
          ${s.plans.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}${active && p.id === active.id ? ' (active)' : ''}</option>`)}
        </select>
        ${isActive ? html`<span className="badge accent">Active plan</span>`
          : html`<button className="btn btn-primary" onClick=${() => { IL.updateSettings({ activePlanId: plan.id }); IL.toast('Switched active plan'); }}>Use this plan</button>`}
        <button className="btn" onClick=${newPlan}><${Icon} name="plus" size=${16} /> New</button>
        <${IL.Menu} items=${[
          { label: 'Rename plan', icon: 'edit', onClick: rename },
          { label: 'Duplicate plan', icon: 'copy', onClick: duplicate },
          { label: 'Delete plan', icon: 'trash', danger: true, onClick: del },
        ]} />
      </div>
    </div>

    <div className="plan-grid">
      ${plan.days.map((day, di) => html`
        <div key=${di} className=${'card plan-day' + (day.rest ? ' rest' : '')}
          onDragOver=${(e) => { if (drag.current) { e.preventDefault(); if (!day.items.length) setOver(di + ':0'); } }}
          onDrop=${(e) => { if (drag.current && !day.items.length) { e.preventDefault(); move(drag.current.d, drag.current.i, di, 0); drag.current = null; setOver(null); } }}>
          <div className="plan-day-head">
            <span className=${'label'} style=${{ width: 34, color: di === todayIdx ? 'var(--accent)' : undefined }}>${IL.DAY_SHORT[di]}</span>
            <input className="day-name-input" value=${day.name} aria-label=${IL.DAY_NAMES[di] + ' workout name'}
              onChange=${(e) => setDay(di, { name: e.target.value })} />
            <button className=${'btn btn-sm ' + (day.rest ? '' : 'btn-ghost')} title="Toggle rest day"
              onClick=${() => setDay(di, day.rest ? { rest: false, name: day.name === 'Rest' ? 'Workout' : day.name } : { rest: true })}>
              <${Icon} name="rest" size=${14} /> ${day.rest ? 'Rest day' : 'Rest'}
            </button>
            <${IL.Menu} items=${[
              { label: 'Add exercise', icon: 'plus', onClick: () => setPicker({ day: di }) },
              { label: 'Copy to other days…', icon: 'copy', onClick: () => setCopyFrom(di) },
              day.items.length && { label: 'Clear exercises', icon: 'trash', danger: true, onClick: async () => {
                if (await IL.confirm({ title: 'Clear ' + IL.DAY_NAMES[di] + '?', message: 'Removes all exercises from this day. History is not affected.', confirmLabel: 'Clear', danger: true })) setDay(di, { items: [] });
              } },
            ]} />
          </div>
          ${(!day.rest || day.items.length > 0) && html`<div className="plan-day-body">
            ${day.rest && html`<div className="tiny muted" style=${{ padding: '4px 8px' }}>Rest day — these exercises are kept but won’t be scheduled.</div>`}
            ${day.items.map((it, ii) => {
              const d = IL.describeVariation(s, it.variationId);
              return html`<div key=${it.id} draggable="true"
                className=${'plan-item' + (over === di + ':' + ii ? ' drop-target' : '')}
                onDragStart=${(e) => { drag.current = { d: di, i: ii }; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); }}
                onDragEnd=${(e) => { e.currentTarget.classList.remove('dragging'); drag.current = null; setOver(null); }}
                onDragOver=${(e) => { if (drag.current) { e.preventDefault(); e.stopPropagation(); setOver(di + ':' + ii); } }}
                onDrop=${(e) => { e.preventDefault(); e.stopPropagation(); if (drag.current) move(drag.current.d, drag.current.i, di, ii); drag.current = null; setOver(null); }}>
                <span className="drag-handle" title="Drag to reorder"><${Icon} name="grip" size=${16} /></span>
                <div className="grow">
                  <div className="clamp-2" style=${{ fontWeight: 550 }}>${d.name}</div>
                  <div className="tiny muted">${d.category}${d.archived ? ' · deleted from library' : ''}</div>
                </div>
                <${MiniNum} label="Sets" value=${it.sets} max=${20} onChange=${(v) => setItem(di, ii, { sets: v })} />
                <span className="muted small">×</span>
                <${MiniNum} label="Target reps" value=${it.reps} max=${200} onChange=${(v) => setItem(di, ii, { reps: v })} />
                <${IL.Menu} items=${[
                  ii > 0 && { label: 'Move up', icon: 'up', onClick: () => move(di, ii, di, ii - 1) },
                  ii < day.items.length - 1 && { label: 'Move down', icon: 'down', onClick: () => move(di, ii, di, ii + 2) },
                  { label: 'Swap variation / exercise', icon: 'swap', onClick: () => setPicker({ day: di, replaceIdx: ii }) },
                  { label: 'View progress', icon: 'chart', onClick: () => IL.nav('/exercise/' + it.variationId) },
                  { label: 'Remove from day', icon: 'trash', danger: true, onClick: () => { const p = clone(fresh()); p.days[di].items.splice(ii, 1); save(p); } },
                ]} />
              </div>`;
            })}
            ${!day.rest && html`<button className="btn btn-ghost btn-sm" style=${{ marginTop: 6 }} onClick=${() => setPicker({ day: di })}>
              <${Icon} name="plus" size=${15} /> Add exercise</button>`}
          </div>`}
        </div>`)}
    </div>
    <p className="tiny muted mt">Drag exercises to reorder (or use ⋯ → Move up/down on touch). Removing or swapping exercises never deletes past workouts.</p>

    ${picker && html`<${IL.ExercisePicker} title=${picker.replaceIdx != null ? 'Swap exercise' : 'Add to ' + IL.DAY_NAMES[picker.day]}
      onClose=${() => setPicker(null)} onPick=${onPick} />`}
    ${copyFrom != null && html`<${CopyDayModal} plan=${plan} from=${copyFrom} onClose=${() => setCopyFrom(null)} onSave=${save} />`}
  </div>`;
};

// Integer field that can be cleared while typing; commits valid values, restores on blur.
function MiniNum({ value, onChange, label, max }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (parseInt(text) !== value) setText(String(value)); }, [value]);
  return html`<input className="mini-num num" inputMode="numeric" aria-label=${label} title=${label} value=${text}
    onFocus=${(e) => e.target.select()}
    onChange=${(e) => { setText(e.target.value); const n = parseInt(e.target.value); if (n >= 1) onChange(Math.min(max, n)); }}
    onBlur=${() => setText(String(value))} />`;
}

function CopyDayModal({ plan, from, onClose, onSave }) {
  const [targets, setTargets] = useState([]);
  const toggle = (i) => setTargets(targets.includes(i) ? targets.filter((x) => x !== i) : [...targets, i]);
  const src = plan.days[from];
  const apply = () => {
    const p = clone(plan);
    targets.forEach((t) => {
      p.days[t] = { name: src.name, rest: src.rest, items: src.items.map((it) => ({ ...it, id: IL.uid() })) };
    });
    onSave(p); onClose(); IL.toast('Copied to ' + targets.length + ' day' + (targets.length === 1 ? '' : 's'));
  };
  return html`<${IL.Modal} title=${'Copy ' + IL.DAY_NAMES[from]} onClose=${onClose}
    footer=${html`<button className="btn btn-ghost" onClick=${onClose}>Cancel</button>
      <button className="btn btn-primary" disabled=${!targets.length} onClick=${apply}>Copy</button>`}>
    <p className="text-2" style=${{ marginTop: 0 }}>Copies “${src.name}” (${src.items.length} exercises) and replaces the selected days.</p>
    <div className="chips">
      ${IL.DAY_NAMES.map((n, i) => i !== from && html`<button key=${i} className=${'chip' + (targets.includes(i) ? ' active' : '')} onClick=${() => toggle(i)}>
        ${n} <span className="muted">· ${plan.days[i].rest ? 'Rest' : plan.days[i].name}</span></button>`)}
    </div>
  <//>`;
}
