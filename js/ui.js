// Shared UI: htm binding, icons, router, modals, confirm/prompt/toast, stepper, exercise picker.
window.IL = window.IL || {};
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const html = htm.bind(React.createElement);
IL.html = html;

// ---------- Icons ----------
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  play: 'M7 4.5v15l12.5-7.5z',
  dumbbell: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM15.5 4.8l3.9-1 3.6 15.3-3.9 1z',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2',
  chart: 'M4 20V11M10 20V5M16 20v-6M2 20h20',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M9 21h6M10 17h4v4h-4z',
  flame: 'M12 3c.8 3.6 5 5.3 5 10a5 5 0 0 1-10 0c0-2.6 1.5-4 2-6.5 1.2 1 2 2.3 2.4 3.6C12 8 12.3 5.5 12 3z',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5.5-5.5',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  skip: 'M5 5l10 7-10 7zM19 5v14',
  compare: 'M8 3v18M16 3v18M3 8h5M16 16h5',
  rest: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
};
IL.Icon = ({ name, size = 18, stroke = 1.8 }) => html`
  <svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth=${name === 'grip' || name === 'more' ? 3 : stroke}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;
const Icon = IL.Icon;

// ---------- Router (hash based, works from file://) ----------
IL.nav = (path) => { if (location.hash !== '#' + path) location.hash = path; };
IL.useRoute = function () {
  const get = () => (location.hash.replace(/^#/, '') || '/dashboard').split('/').filter(Boolean);
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => { setRoute(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
};

// ---------- Back button closes dialogs (Android) ----------
// Open dialogs share one extra history entry; Back pops it and closes the top dialog.
// When the last dialog closes in-app, the entry is removed (deferred, so a dialog that
// replaces another in the same render keeps it).
const modalStack = [];
let ignorePop = false;
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; return; }
  const top = modalStack[modalStack.length - 1];
  if (top) top.close();
});
function useBackToClose(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const entry = { close: () => ref.current && ref.current() };
    modalStack.push(entry);
    if (!(history.state && history.state.ilModal)) history.pushState({ ilModal: true }, '');
    return () => {
      modalStack.splice(modalStack.indexOf(entry), 1);
      setTimeout(() => {
        if (!modalStack.length && history.state && history.state.ilModal) { ignorePop = true; history.back(); }
      }, 0);
    };
  }, []);
  // Back popped our entry; re-push it if dialogs are still open underneath.
  useEffect(() => () => {
    setTimeout(() => { if (modalStack.length && !(history.state && history.state.ilModal)) history.pushState({ ilModal: true }, ''); }, 0);
  }, []);
}

// ---------- Modal ----------
IL.Modal = function ({ title, onClose, children, footer, wide }) {
  useBackToClose(onClose);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);
  return html`
    <div className="overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>${title}</h2>
          ${onClose && html`<button className="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button>`}
        </div>
        <div className="modal-body">${children}</div>
        ${footer && html`<div className="modal-foot">${footer}</div>`}
      </div>
    </div>`;
};

// ---------- Imperative dialogs: IL.confirm / IL.prompt / IL.toast ----------
let dialogHost = null;
IL.confirm = (opts) => new Promise((resolve) => dialogHost && dialogHost({ type: 'confirm', ...opts, resolve }));
IL.prompt = (opts) => new Promise((resolve) => dialogHost && dialogHost({ type: 'prompt', ...opts, resolve }));
let toastHost = null;
IL.toast = (text, kind) => toastHost && toastHost(text, kind);

IL.DialogHost = function () {
  const [d, setD] = useState(null);
  const [val, setVal] = useState('');
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    dialogHost = (opts) => { setVal(opts.value || ''); setD(opts); };
    toastHost = (text, kind) => {
      const id = IL.uid();
      setToasts((t) => [...t, { id, text, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'pr' ? 3500 : 2200);
    };
  }, []);
  const close = (result) => { d.resolve(result); setD(null); };
  return html`
    ${d && html`
      <${IL.Modal} title=${d.title} onClose=${() => close(d.type === 'prompt' ? null : false)}
        footer=${html`
          <button className="btn btn-ghost" onClick=${() => close(d.type === 'prompt' ? null : false)}>Cancel</button>
          <button className=${'btn ' + (d.danger ? 'btn-danger' : 'btn-primary')} disabled=${d.type === 'prompt' && !val.trim()}
            onClick=${() => close(d.type === 'prompt' ? val.trim() : true)}>${d.confirmLabel || 'OK'}</button>`}>
        ${d.message && html`<p className="text-2" style=${{ marginTop: 0 }}>${d.message}</p>`}
        ${d.type === 'prompt' && html`
          <input className="input" autoFocus value=${val} placeholder=${d.placeholder || ''}
            onChange=${(e) => setVal(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && val.trim()) close(val.trim()); }} />`}
      <//>`}
    <div className="toast-wrap">${toasts.map((t) => html`<div key=${t.id} className=${'toast ' + (t.kind || '')}>${t.text}</div>`)}</div>`;
};

// ---------- Dropdown menu ----------
IL.Menu = function ({ items, icon = 'more', label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', on);
    document.addEventListener('touchstart', on);
    return () => { document.removeEventListener('mousedown', on); document.removeEventListener('touchstart', on); };
  }, [open]);
  return html`
    <div className="menu-wrap" ref=${ref}>
      <button className="icon-btn" aria-label=${label} onClick=${() => setOpen(!open)}><${Icon} name=${icon} /></button>
      ${open && html`<div className="menu">
        ${items.filter(Boolean).map((it, i) => html`
          <button key=${i} className=${it.danger ? 'danger' : ''} onClick=${() => { setOpen(false); it.onClick(); }}>
            ${it.icon && html`<${Icon} name=${it.icon} size=${16} />`}${it.label}
          </button>`)}
      </div>`}
    </div>`;
};

// ---------- Number stepper (weight / reps) ----------
IL.Stepper = function ({ value, onChange, step = 1, min = 0, decimals = true, label }) {
  const [text, setText] = useState(IL.fmt.w(value));
  useEffect(() => { if (parseFloat(text) !== Number(value)) setText(IL.fmt.w(value)); }, [value]);
  const commit = (t) => {
    const n = parseFloat(String(t).replace(',', '.'));
    const v = isNaN(n) ? min : Math.max(min, decimals ? n : Math.round(n));
    onChange(v);
  };
  const bump = (d) => { const v = Math.max(min, parseFloat(((Number(value) || 0) + d).toFixed(2))); setText(IL.fmt.w(v)); onChange(v); };
  return html`
    <div className="stepper">
      <button type="button" aria-label=${'Decrease ' + label} onClick=${() => bump(-step)}>−</button>
      <input inputMode=${decimals ? 'decimal' : 'numeric'} aria-label=${label} value=${text}
        onFocus=${(e) => e.target.select()}
        onChange=${(e) => { setText(e.target.value); const n = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(n)) commit(e.target.value); }}
        onBlur=${() => { commit(text); setText(IL.fmt.w(parseFloat(text.replace(',', '.')) || 0)); }} />
      <button type="button" aria-label=${'Increase ' + label} onClick=${() => bump(step)}>+</button>
    </div>`;
};

// ---------- Exercise picker ----------
// Choose an exercise, then a specific variation. Variations are what get tracked.
IL.ExercisePicker = function ({ onPick, onClose, title = 'Add exercise' }) {
  const s = IL.useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const query = q.trim().toLowerCase();

  const list = useMemo(() => s.exercises
    .filter((e) => !e.archived && (cat === 'All' || e.category === cat))
    .map((e) => ({ ex: e, vars: s.variations.filter((v) => v.exerciseId === e.id && !v.archived) }))
    .filter(({ ex, vars }) => !query || ex.name.toLowerCase().includes(query) || vars.some((v) => v.name.toLowerCase().includes(query)))
    .sort((a, b) => a.ex.name.localeCompare(b.ex.name)), [s, cat, query]);

  if (creating) return html`<${IL.ExerciseForm} initialName=${q} initialCategory=${cat === 'All' ? 'Chest' : cat}
    onClose=${() => setCreating(false)} onSaved=${(vid) => vid && onPick(vid)} />`;

  return html`
    <${IL.Modal} title=${title} onClose=${onClose}
      footer=${html`<button className="btn" onClick=${() => setCreating(true)}><${Icon} name="plus" size=${16} /> Custom exercise</button>`}>
      <div className="stack-sm">
        <div className="row" style=${{ position: 'relative' }}>
          <input className="input" autoFocus placeholder="Search exercises or variations" value=${q} onChange=${(e) => setQ(e.target.value)} />
        </div>
        <div className="chips" style=${{ marginBottom: 6 }}>
          ${['All', ...IL.CATEGORIES].map((c) => html`<button key=${c} className=${'chip' + (cat === c ? ' active' : '')} onClick=${() => setCat(c)}>${c}</button>`)}
        </div>
        ${list.length === 0 && html`<div className="empty">No matches. Create a custom exercise below.</div>`}
        ${list.map(({ ex, vars }) => {
          const expanded = open === ex.id || (query && vars.some((v) => v.name.toLowerCase().includes(query)) && !ex.name.toLowerCase().includes(query)) || list.length === 1;
          return html`
            <div key=${ex.id} className="picker-ex">
              <div className="picker-ex-head" onClick=${() => setOpen(open === ex.id ? null : ex.id)}>
                <${Icon} name=${expanded ? 'chevronDown' : 'chevronRight'} size=${16} />
                <div className="grow"><div style=${{ fontWeight: 600 }}>${ex.name}</div><div className="tiny muted">${ex.category} · ${vars.length} variation${vars.length === 1 ? '' : 's'}</div></div>
              </div>
              ${expanded && html`<div className="picker-vars">
                ${vars.map((v) => {
                  const r = IL.stats.records(s, v.id);
                  return html`<button key=${v.id} className="picker-var" onClick=${() => onPick(v.id)}>
                    <span>${v.name}</span>
                    <span className="tiny muted num">${r.sessions ? 'Best ' + IL.fmt.w(r.maxWeight) + ' kg' : 'New'}</span>
                  </button>`;
                })}
              </div>`}
            </div>`;
        })}
      </div>
    <//>`;
};

// Create or edit an exercise and its variations. Calls onSaved(firstVariationId).
IL.ExerciseForm = function ({ exercise, initialName = '', initialCategory = 'Chest', onClose, onSaved }) {
  const s = IL.useStore();
  const [name, setName] = useState(exercise ? exercise.name : initialName);
  const [category, setCategory] = useState(exercise ? exercise.category : initialCategory);
  const [vars, setVars] = useState(exercise ? '' : '');
  const save = () => {
    const now = Date.now();
    const ex = exercise ? { ...exercise, name: name.trim(), category } : { id: IL.uid(), name: name.trim(), category, custom: true, archived: false, createdAt: now };
    IL.store.put('exercises', ex);
    let names = vars.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    if (!exercise && !names.length) names = ['Standard'];
    const created = names.map((n) => IL.store.put('variations', { id: IL.uid(), exerciseId: ex.id, name: n, custom: true, archived: false, createdAt: now }));
    IL.toast(exercise ? 'Exercise updated' : 'Exercise created');
    onClose();
    onSaved && onSaved(created[0] ? created[0].id : null);
  };
  return html`
    <${IL.Modal} title=${exercise ? 'Edit exercise' : 'New custom exercise'} onClose=${onClose}
      footer=${html`<button className="btn btn-ghost" onClick=${onClose}>Cancel</button>
        <button className="btn btn-primary" disabled=${!name.trim()} onClick=${save}>Save</button>`}>
      <div className="stack">
        <label className="field"><span>Exercise name</span>
          <input className="input" autoFocus value=${name} placeholder="e.g. Pendlay Row" onChange=${(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Category</span>
          <select className="select" value=${category} onChange=${(e) => setCategory(e.target.value)}>
            ${IL.CATEGORIES.map((c) => html`<option key=${c}>${c}</option>`)}
          </select></label>
        <label className="field"><span>${exercise ? 'Add variations' : 'Variations'} <span className="muted">(comma or new line separated${exercise ? '' : ', defaults to “Standard”'})</span></span>
          <textarea className="textarea" value=${vars} placeholder="Barbell, Dumbbell, Deficit" onChange=${(e) => setVars(e.target.value)} /></label>
      </div>
    <//>`;
};

IL.Empty = ({ children }) => html`<div className="empty">${children}</div>`;
