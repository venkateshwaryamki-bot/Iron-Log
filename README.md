# Ironlog — personal workout & progressive overload tracker

No build step. Open `index.html` in Chrome, Edge or Firefox (double-click works). React, ReactDOM and htm load from a CDN, so the first load needs internet; after that the browser cache usually covers it.

Data lives in the browser's IndexedDB, on this device only. Use **Settings → Full backup (JSON)** regularly. Clearing site data deletes it.

## On Android
Ironlog is an installable web app (PWA). Host this folder on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages), open the URL in Chrome on the phone, then tap **⋮ → Install app** (or **Add to Home screen**). It then opens full screen from its own icon and keeps working offline: `sw.js` caches the app and its libraries. While a workout is running, the screen stays on, completing a set vibrates and starts the rest timer, and the Back button closes dialogs.

HTTPS is required. Over plain `http://` from another device, offline mode and installing are disabled.

When you change any app file, bump `VERSION` in `sw.js` so phones fetch the new files.

## Structure
- `js/db.js` — IndexedDB stores and the schema (see the comment at the top)
- `js/store.js` — in-memory cache with write-through autosave, and the domain helpers
- `js/stats.js` — volume, previous session, records/PRs, streak
- `js/seed.js` — built-in exercise library and starter plan
- `js/ui.js`, `js/charts.js` — shared components and SVG charts
- `js/screens/*` — Dashboard, Planner, Library and progress, Workout logger, History and compare, Analytics, Settings

## Data rules
- Performance is tracked per **variation** (for example Wide Grip and Close Grip Lat Pulldown are separate).
- Sessions save the exercise and variation names at the time they were logged. Editing or deleting plans and exercises never changes history.
- A deleted variation that has history is archived, not removed. Turn on "Show deleted" in the Library to restore it.
- Volume = Σ weight × reps over completed sets.
