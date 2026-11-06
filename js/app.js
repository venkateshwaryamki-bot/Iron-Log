// App shell: navigation, routing, theme.
window.IL = window.IL || {};

const NAV = [
  { path: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'home' },
  { path: 'plan', label: 'Weekly Plan', short: 'Plan', icon: 'calendar' },
  { path: 'workout', label: 'Start Workout', short: 'Train', icon: 'dumbbell' },
  { path: 'library', label: 'Exercise Library', short: 'Library', icon: 'library' },
  { path: 'history', label: 'History', short: 'History', icon: 'history' },
  { path: 'analytics', label: 'Analytics', short: 'Stats', icon: 'chart' },
  { path: 'settings', label: 'Settings', short: 'Settings', icon: 'settings' },
];

function App() {
  const s = IL.useStore();
  const route = IL.useRoute();
  const theme = IL.settings(s).theme || 'dark';
  const active = IL.activeSession(s);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f4f4f2' : '#121316';
  }, [theme]);

  const [r0, r1, r2, r3] = route;
  let screen;
  switch (r0) {
    case 'plan': screen = html`<${IL.Planner} />`; break;
    case 'workout': screen = html`<${IL.Workout} />`; break;
    case 'library': screen = html`<${IL.Library} />`; break;
    case 'exercise': screen = html`<${IL.ExerciseDetail} key=${r1} vid=${r1} />`; break;
    case 'history':
      screen = r1 && r2 === 'edit' ? html`<${IL.SessionEditor} key=${r1} sessionId=${r1} mode="edit" />`
        : r1 ? html`<${IL.SessionDetail} id=${r1} />` : html`<${IL.History} />`;
      break;
    case 'compare': screen = html`<${IL.Compare} a=${r1} b=${r2} />`; break;
    case 'analytics': screen = html`<${IL.Analytics} />`; break;
    case 'settings': screen = html`<${IL.Settings} />`; break;
    default: screen = html`<${IL.Dashboard} />`;
  }
  const current = r0 === 'exercise' ? 'library' : r0 === 'compare' ? 'history' : r0 || 'dashboard';

  return html`<div className="app">
    <nav className="sidebar">
      <div className="brand"><span className="brand-mark"><${Icon} name="dumbbell" size=${16} stroke=${2.2} /></span>Ironlog</div>
      ${NAV.map((n) => html`<button key=${n.path} className=${'nav-item' + (current === n.path ? ' active' : '')} onClick=${() => IL.nav('/' + n.path)}>
        <${Icon} name=${n.icon} /> ${n.path === 'workout' && active ? 'Active Workout' : n.label}
        ${n.path === 'workout' && active && html`<span className="dot" title="Workout in progress" />`}
      </button>`)}
    </nav>
    <div className="main">
      <header className="topbar">
        <div className="brand" style=${{ padding: 0 }}><span className="brand-mark"><${Icon} name="dumbbell" size=${16} stroke=${2.2} /></span>Ironlog</div>
        <button className="icon-btn" aria-label="Settings" onClick=${() => IL.nav('/settings')}><${Icon} name="settings" /></button>
      </header>
      ${screen}
    </div>
    <nav className="bottom-nav">
      ${NAV.filter((n) => n.path !== 'settings').map((n) => html`<button key=${n.path} className=${current === n.path ? 'active' : ''} onClick=${() => IL.nav('/' + n.path)}>
        <${Icon} name=${n.icon} size=${21} />${n.short}
        ${n.path === 'workout' && active && html`<span className="dot" />`}
      </button>`)}
    </nav>
    <${IL.DialogHost} />
  </div>`;
}

// ---------- Installable app (PWA) ----------
// Offline caching and "Install app" need https (or localhost); opened as a plain file they're skipped.
IL.install = { prompt: null, listeners: new Set() };
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  IL.install.prompt = e;
  IL.install.listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => { IL.install.prompt = null; IL.install.listeners.forEach((l) => l()); });
IL.useInstallPrompt = function () {
  const [, bump] = useState(0);
  useEffect(() => { const l = () => bump((n) => n + 1); IL.install.listeners.add(l); return () => IL.install.listeners.delete(l); }, []);
  return IL.install.prompt;
};
IL.isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker failed', err)));
}

(async function boot() {
  // Ask the browser not to evict workout data when the phone is low on space.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const root = ReactDOM.createRoot(document.getElementById('root'));
  try {
    await IL.store.init();
    root.render(html`<${App} />`);
  } catch (err) {
    console.error(err);
    root.render(html`<div className="page"><h1>Couldn’t open storage</h1><p className="muted">${String(err.message || err)}</p>
      <p className="small muted">Ironlog keeps data in your browser’s IndexedDB. Private/incognito windows or blocked site data can prevent this.</p></div>`);
  }
})();
