// Dependency-free SVG charts sized to their container, with hover tooltips.
window.IL = window.IL || {};

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  // Same element type/class in both branches, so React keeps the node and the observer stays attached.
  useEffect(() => {
    if (!ref.current) return;
    setW(ref.current.clientWidth);
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceStep(range, count) {
  const raw = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

function yScale(values, zeroBased) {
  let lo = zeroBased ? 0 : Math.min(...values);
  let hi = Math.max(...values, zeroBased ? 1 : -Infinity);
  if (lo === hi) { hi = hi + (hi ? Math.abs(hi) * 0.2 : 1); lo = zeroBased ? 0 : Math.max(0, lo - (lo * 0.2 || 1)); }
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(parseFloat(v.toFixed(4)));
  return { lo, hi, ticks };
}

const PAD = { l: 44, r: 14, t: 14, b: 26 };

// points: [{ x: timestamp, y, tip, pr }]
IL.LineChart = function ({ points, height = 200, yFmt = IL.fmt.w, unit = '', zeroBased = false }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  if (!points.length) return html`<div className="chart" ref=${ref}><${IL.Empty}>No data yet.<//></div>`;
  const W = Math.max(width, 200), H = height;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const { lo, hi, ticks } = yScale(points.map((p) => p.y), zeroBased);
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const px = (x) => PAD.l + (x1 === x0 ? iw / 2 : ((x - x0) / (x1 - x0)) * iw);
  const py = (y) => PAD.t + ih - ((y - lo) / (hi - lo || 1)) * ih;
  const d = points.map((p, i) => (i ? 'L' : 'M') + px(p.x).toFixed(1) + ',' + py(p.y).toFixed(1)).join('');
  const area = d + `L${px(points[points.length - 1].x).toFixed(1)},${PAD.t + ih}L${px(points[0].x).toFixed(1)},${PAD.t + ih}Z`;
  const xLabels = points.length === 1 ? [points[0]] : [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]]
    .filter((p, i, a) => a.indexOf(p) === i);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(px(p.x) - mx) < Math.abs(px(points[best].x) - mx)) best = i; });
    setHover(best);
  };
  const hp = hover != null ? points[hover] : null;

  return html`
    <div className="chart" ref=${ref}>
      ${width > 0 && html`
        <svg width=${W} height=${H} onPointerMove=${onMove} onPointerLeave=${() => setHover(null)} style=${{ touchAction: 'pan-y' }}>
          ${ticks.map((t) => html`<g key=${t}>
            <line className="grid-line" x1=${PAD.l} x2=${W - PAD.r} y1=${py(t)} y2=${py(t)} />
            <text className="axis-text" x=${PAD.l - 8} y=${py(t) + 4} textAnchor="end">${yFmt(t)}</text></g>`)}
          ${xLabels.map((p, i) => html`<text key=${i} className="axis-text" x=${px(p.x)} y=${H - 6}
            textAnchor=${xLabels.length > 1 && i === 0 ? 'start' : xLabels.length > 1 && i === xLabels.length - 1 ? 'end' : 'middle'}>${IL.fmt.dateShort(p.x)}</text>`)}
          <path className="series-area" d=${area} />
          <path className="series-line" d=${d} />
          ${hp && html`<line className="crosshair" x1=${px(hp.x)} x2=${px(hp.x)} y1=${PAD.t} y2=${PAD.t + ih} />`}
          ${points.map((p, i) => (points.length <= 40 || p.pr || i === hover) && html`<circle key=${i} className=${'series-dot' + (p.pr ? ' pr' : '')}
            cx=${px(p.x)} cy=${py(p.y)} r=${i === hover ? 6 : 4.5} />`)}
        </svg>
        ${hp && html`<div className="tooltip" style=${{ left: Math.min(Math.max(px(hp.x), 70), W - 70), top: py(hp.y) }}>
          <div className="muted tiny">${IL.fmt.date(hp.x)}</div>
          <b>${yFmt(hp.y)}${unit}</b>${hp.tip ? html`<div className="tiny text-2">${hp.tip}</div>` : null}
          ${hp.pr && html`<div className="tiny" style=${{ color: 'var(--pr)' }}>Personal record</div>`}
        </div>`}`}
    </div>`;
};

// bars: [{ label, y, tip }]
IL.BarChart = function ({ bars, height = 180, yFmt = IL.fmt.int, unit = '' }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  if (!bars.length) return html`<div className="chart" ref=${ref}><${IL.Empty}>No data yet.<//></div>`;
  const W = Math.max(width, 200), H = height;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const { hi, ticks } = yScale(bars.map((b) => b.y), true);
  const band = iw / bars.length;
  const bw = Math.max(3, Math.min(36, band - 2));
  const py = (y) => PAD.t + ih - (y / (hi || 1)) * ih;
  const every = Math.ceil(bars.length / Math.max(1, Math.floor(iw / 46)));
  const barPath = (x, y, w, h) => {
    if (h <= 0) return '';
    const r = Math.min(4, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };
  const hb = hover != null ? bars[hover] : null;
  return html`
    <div className="chart" ref=${ref}>
      ${width > 0 && html`
        <svg width=${W} height=${H} onPointerLeave=${() => setHover(null)}>
          ${ticks.map((t) => html`<g key=${t}>
            <line className=${t === 0 ? 'base-line' : 'grid-line'} x1=${PAD.l} x2=${W - PAD.r} y1=${py(t)} y2=${py(t)} />
            <text className="axis-text" x=${PAD.l - 8} y=${py(t) + 4} textAnchor="end">${yFmt(t)}</text></g>`)}
          ${bars.map((b, i) => {
            const x = PAD.l + band * i + (band - bw) / 2;
            const y = py(b.y);
            return html`<g key=${i}>
              <path className=${'bar' + (hover != null && hover !== i ? ' dim' : '')} d=${barPath(x, y, bw, PAD.t + ih - y)} />
              ${i % every === 0 && html`<text className="axis-text" x=${x + bw / 2} y=${H - 6} textAnchor="middle">${b.label}</text>`}
              <rect x=${PAD.l + band * i} y=${PAD.t} width=${band} height=${ih} fill="transparent"
                onPointerEnter=${() => setHover(i)} onPointerDown=${() => setHover(i)} />
            </g>`;
          })}
        </svg>
        ${hb && html`<div className="tooltip" style=${{ left: Math.min(Math.max(PAD.l + band * hover + band / 2, 70), W - 70), top: py(hb.y) }}>
          <div className="muted tiny">${hb.tip || hb.label}</div><b>${yFmt(hb.y)}${unit}</b>
        </div>`}`}
    </div>`;
};

// Horizontal bars for category share (single hue: it's one measure across categories).
IL.HBars = function ({ rows, fmt = IL.fmt.int, unit = '' }) {
  if (!rows.length) return html`<${IL.Empty}>No data yet.<//>`;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return html`<div>${rows.map((r) => html`
    <div key=${r.label} className="hbar" title=${r.label + ': ' + fmt(r.value) + unit}>
      <span className="ellipsis text-2">${r.label}</span>
      <div className="hbar-track"><div className="hbar-fill" style=${{ width: (r.value / max) * 100 + '%' }} /></div>
      <span className="num small" style=${{ textAlign: 'right' }}>${fmt(r.value)}${unit}</span>
    </div>`)}</div>`;
};
