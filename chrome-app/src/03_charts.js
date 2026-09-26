/* ==== charts ==== */
"use strict";
/* ============================ charts (inline SVG, theme tokens) ============================ */
function niceTicks(lo, hi, n) {
  if (!isN(lo) || !isN(hi)) return [0, 1];
  if (hi === lo) { hi = lo + 1; }
  const span = hi - lo, step0 = span / Math.max(1, n || 5), mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag; const t0 = Math.floor(lo / step) * step, out = [];
  for (let v = t0; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(10));
  return out;
}
function chartFrame(host, W, H, aria) { host.innerHTML = ''; const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': aria || 'chart' }); host.appendChild(s); return s; }
/* line chart: spec {series:[{name,color,pts:[[x,y]],dash,area,width}], x:{min,max,ticks,fmt,label}, y:{min,max,fmt,label,zero}, H, vlines:[{x,label}], bands:[{x0,x1,label}], legend} */
function lineChart(host, spec) {
  const W = spec.W || 820, H = spec.H || 300, L = spec.L || 58, R = spec.R || 20, T = spec.T || 18, B = spec.B || 42;
  const s = chartFrame(host, W, H, spec.aria);
  const all = spec.series.flatMap(se => se.pts.filter(p => isN(p[1])));
  let x0 = spec.x && isN(spec.x.min) ? spec.x.min : Math.min(...all.map(p => p[0])), x1 = spec.x && isN(spec.x.max) ? spec.x.max : Math.max(...all.map(p => p[0]));
  let y0 = spec.y && isN(spec.y.min) ? spec.y.min : Math.min(...all.map(p => p[1])), y1 = spec.y && isN(spec.y.max) ? spec.y.max : Math.max(...all.map(p => p[1]));
  if (spec.y && spec.y.zero) y0 = Math.min(0, y0);
  const yt = niceTicks(y0, y1, spec.y && spec.y.n || 5); y0 = Math.min(y0, yt[0]); y1 = Math.max(y1, yt[yt.length - 1]);
  const X = v => L + (W - L - R) * (v - x0) / ((x1 - x0) || 1), Y = v => H - B - (H - B - T) * (v - y0) / ((y1 - y0) || 1);
  const fx = spec.x && spec.x.fmt || (v => v), fy = spec.y && spec.y.fmt || (v => N(v));
  (spec.bands || []).forEach(b => { s.appendChild(svgEl('rect', { x: X(b.x0), y: T, width: Math.max(1, X(b.x1) - X(b.x0)), height: H - B - T, fill: cssv('--sunk'), opacity: .8 })); if (b.label) s.appendChild(svgEl('text', { x: X(b.x0) + 4, y: T + 12, class: 'lblm' }, b.label)); });
  yt.forEach(v => { s.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'gl' })); s.appendChild(svgEl('text', { x: L - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, fy(v))); });
  const xt = spec.x && spec.x.ticks || niceTicks(x0, x1, 8).filter(v => v >= x0 && v <= x1);
  xt.forEach(v => s.appendChild(svgEl('text', { x: X(v), y: H - B + 17, class: 'ax', 'text-anchor': 'middle' }, fx(v))));
  s.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(y0), y2: Y(y0), class: 'base' }));
  if (spec.x && spec.x.label) s.appendChild(svgEl('text', { x: L + (W - L - R) / 2, y: H - 6, class: 'axl', 'text-anchor': 'middle' }, spec.x.label));
  if (spec.y && spec.y.label) s.appendChild(svgEl('text', { x: 4, y: 11, class: 'axl' }, spec.y.label));
  (spec.vlines || []).forEach(v => { s.appendChild(svgEl('line', { x1: X(v.x), x2: X(v.x), y1: T, y2: H - B, stroke: cssv('--ink-3'), 'stroke-dasharray': '3 4', 'stroke-width': 1 })); if (v.label) s.appendChild(svgEl('text', { x: X(v.x) + 4, y: T + 11 + (v.dy || 0), class: 'lblm' }, v.label)); });
  (spec.hlines || []).forEach(h => { if (h.y < y0 || h.y > y1) return; s.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(h.y), y2: Y(h.y), stroke: cssv('--ink-3'), 'stroke-dasharray': '2 4', 'stroke-width': 1 })); if (h.label) s.appendChild(svgEl('text', { x: W - R - 4, y: Y(h.y) - 4, class: 'lblm', 'text-anchor': 'end' }, h.label)); });
  spec.series.forEach(se => {
    const pts = se.pts.filter(p => isN(p[1])); if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    if (se.area) s.appendChild(svgEl('path', { d: d + ` L${X(pts[pts.length - 1][0]).toFixed(1)} ${Y(y0)} L${X(pts[0][0]).toFixed(1)} ${Y(y0)} Z`, fill: se.color, opacity: .12 }));
    s.appendChild(svgEl('path', { d, fill: 'none', stroke: se.color, 'stroke-width': se.width || 2, 'stroke-dasharray': se.dash || '', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    if (se.dots) pts.forEach(p => s.appendChild(svgEl('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3, fill: se.color, stroke: cssv('--card'), 'stroke-width': 1.5 })));
    const last = pts[pts.length - 1]; s.appendChild(svgEl('circle', { cx: X(last[0]), cy: Y(last[1]), r: 4, fill: se.color, stroke: cssv('--card'), 'stroke-width': 2 }));
    if (se.endLabel) s.appendChild(svgEl('text', { x: Math.min(W - R - 2, X(last[0]) + 6), y: Y(last[1]) - 7, class: 'lbl', 'text-anchor': X(last[0]) > W - 80 ? 'end' : 'start' }, se.endLabel));
  });
  (spec.marks || []).forEach(m => { s.appendChild(svgEl('circle', { cx: X(m.x), cy: Y(m.y), r: 4.5, fill: m.color || cssv('--ink'), stroke: cssv('--card'), 'stroke-width': 2 })); if (m.label) s.appendChild(svgEl('text', { x: X(m.x) + (m.dx || 7), y: Y(m.y) + (m.dy || -7), class: 'lbl', 'text-anchor': m.anchor || 'start' }, m.label)); });
  // hover layer
  const xs = [...new Set(all.map(p => p[0]))].sort((a, b) => a - b);
  const cross = svgEl('line', { y1: T, y2: H - B, stroke: cssv('--ink-3'), 'stroke-width': 1, opacity: 0 }); s.appendChild(cross);
  const hit = svgEl('rect', { x: L, y: T, width: W - L - R, height: H - B - T, class: 'hit' }); s.appendChild(hit);
  hit.addEventListener('mousemove', e => { const r = s.getBoundingClientRect(); const vx = x0 + ((e.clientX - r.left) * W / r.width - L) / (W - L - R) * (x1 - x0); let best = xs[0]; xs.forEach(x => { if (Math.abs(x - vx) < Math.abs(best - vx)) best = x; }); cross.setAttribute('x1', X(best)); cross.setAttribute('x2', X(best)); cross.setAttribute('opacity', .6);
    const rows = spec.series.map(se => { const p = se.pts.find(q => q[0] === best); return p && isN(p[1]) ? tipRow(`<span style="display:inline-block;width:9px;height:3px;background:${se.color};margin-right:6px;vertical-align:3px"></span>${esc(se.name)}`, (se.fmt || fy)(p[1])) : ''; }).join('');
    showTip(`<div class="tt">${esc(spec.tipTitle ? spec.tipTitle(best) : fx(best))}</div>${rows}`, e); });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('opacity', 0); hideTip(); });
  return s;
}
function legendRow(items) { return `<div class="chartleg">${items.map(i => `<span><i class="${i.sq ? 'sq' : ''}" style="background:${i.color}${i.dash ? ';background:repeating-linear-gradient(90deg,' + i.color + ' 0 4px,transparent 4px 7px)' : ''}"></i>${esc(i.name)}</span>`).join('')}</div>`; }
/* bar chart: spec {cats, series:[{name,color,values}], stacked, H, fmt, yLabel, horizontal, highlight} */
function barChart(host, spec) {
  const W = spec.W || 820, H = spec.H || 280, L = spec.L || 58, R = spec.R || 16, T = spec.T || 16, B = spec.B || (spec.rot ? 64 : 40);
  const s = chartFrame(host, W, H, spec.aria); const cats = spec.cats, ser = spec.series; const n = cats.length;
  const tot = cats.map((_, i) => spec.stacked ? sum(ser.map(se => se.values[i])) : Math.max(...ser.map(se => se.values[i] || 0)));
  let y1 = Math.max(...tot, spec.yMax || 0), y0 = Math.min(0, ...ser.flatMap(se => se.values.filter(isN)));
  const yt = niceTicks(y0, y1, 5); y1 = yt[yt.length - 1]; y0 = Math.min(y0, yt[0]);
  const X = i => L + (W - L - R) * i / n, bw = (W - L - R) / n, Y = v => H - B - (H - B - T) * (v - y0) / ((y1 - y0) || 1);
  const fy = spec.fmt || (v => N(v));
  yt.forEach(v => { s.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'gl' })); s.appendChild(svgEl('text', { x: L - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, fy(v))); });
  const every = Math.ceil(n / (spec.maxLabels || 18));
  cats.forEach((c, i) => {
    let acc = 0; const inner = spec.stacked ? 1 : ser.length; const pad = Math.min(8, bw * 0.18), gw = (bw - pad * 2) / inner;
    ser.forEach((se, j) => { const v = se.values[i]; if (!isN(v)) return; const x = spec.stacked ? X(i) + pad : X(i) + pad + j * gw; const w = Math.max(1, (spec.stacked ? bw - pad * 2 : gw) - (spec.stacked ? 0 : 1.5));
      const yA = spec.stacked ? Y(acc + v) : Y(Math.max(0, v)), yB = spec.stacked ? Y(acc) : Y(Math.min(0, v)); acc += spec.stacked ? v : 0;
      const col = (spec.highlight && spec.highlight(i, j)) || se.color;
      const r = svgEl('rect', { x: x.toFixed(1), y: yA.toFixed(1), width: w.toFixed(1), height: Math.max(0.5, yB - yA - (spec.stacked ? 1.5 : 0)).toFixed(1), fill: col, rx: Math.min(3, w / 3) });
      r.addEventListener('mousemove', e => showTip(`<div class="tt">${esc(c)}</div>${ser.map(q => isN(q.values[i]) ? tipRow(esc(q.name), (q.fmt || fy)(q.values[i])) : '').join('')}${spec.tipExtra ? spec.tipExtra(i) : ''}`, e)); r.addEventListener('mouseleave', hideTip);
      s.appendChild(r); });
    if (i % every === 0) { const t = svgEl('text', { x: X(i) + bw / 2, y: H - B + 16, class: 'ax', 'text-anchor': spec.rot ? 'end' : 'middle', transform: spec.rot ? `rotate(-40 ${X(i) + bw / 2} ${H - B + 16})` : '' }, c); s.appendChild(t); }
  });
  s.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: 'base' }));
  if (spec.yLabel) s.appendChild(svgEl('text', { x: 4, y: 11, class: 'axl' }, spec.yLabel));
  (spec.vlabel || []).forEach(v => s.appendChild(svgEl('text', { x: X(v.i) + bw / 2, y: Y(v.y) - 6, class: 'lbl', 'text-anchor': 'middle' }, v.t)));
  return s;
}
/* horizontal bars with labels: rows [{l, v, color, t}] */
function hbarChart(host, rows, spec) {
  spec = spec || {}; const W = spec.W || 700, rowH = spec.rowH || 24, T = 6, L = spec.L || 190, R = spec.R || 70; const H = T * 2 + rows.length * rowH;
  const s = chartFrame(host, W, H, spec.aria); const vmax = spec.max || Math.max(...rows.map(r => Math.abs(r.v)), 1e-9); const vmin = spec.min != null ? spec.min : Math.min(0, ...rows.map(r => r.v));
  const X = v => L + (W - L - R) * (v - vmin) / ((vmax - vmin) || 1);
  rows.forEach((r, i) => { const y = T + i * rowH; s.appendChild(svgEl('text', { x: L - 8, y: y + rowH / 2 + 4, class: 'ax', 'text-anchor': 'end', style: 'fill:' + cssv('--ink-2') }, r.l));
    const xa = X(Math.min(0, r.v)), xb = X(Math.max(0, r.v)); const rect = svgEl('rect', { x: xa, y: y + 5, width: Math.max(1, xb - xa), height: rowH - 10, rx: 3, fill: r.color || cssv('--accent') }); s.appendChild(rect);
    if (r.tip) { rect.addEventListener('mousemove', e => showTip(r.tip, e)); rect.addEventListener('mouseleave', hideTip); }
    s.appendChild(svgEl('text', { x: xb + 6, y: y + rowH / 2 + 4, class: 'lbl' }, r.t != null ? r.t : N(r.v))); });
  if (vmin < 0) s.appendChild(svgEl('line', { x1: X(0), x2: X(0), y1: 0, y2: H, class: 'base' }));
  return s;
}
/* scatter: spec {pts:[{x,y,c,r,lab,tip}], x:{label,fmt,min,max}, y:{label,fmt,min,max}, fit, labels:n} */
function scatter(host, spec) {
  const W = spec.W || 700, H = spec.H || 360, L = 62, R = 22, T = 18, B = 46; const s = chartFrame(host, W, H, spec.aria);
  const pts = spec.pts.filter(p => isN(p.x) && isN(p.y)); if (!pts.length) { s.appendChild(svgEl('text', { x: 20, y: 40, class: 'ax' }, 'No points to show')); return { r: NaN }; }
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const pad = (a, b) => (b - a) * 0.06 || 1;
  let x0 = spec.x && isN(spec.x.min) ? spec.x.min : Math.min(...xs) - pad(Math.min(...xs), Math.max(...xs)), x1 = spec.x && isN(spec.x.max) ? spec.x.max : Math.max(...xs) + pad(Math.min(...xs), Math.max(...xs));
  let y0 = spec.y && isN(spec.y.min) ? spec.y.min : Math.min(...ys) - pad(Math.min(...ys), Math.max(...ys)), y1 = spec.y && isN(spec.y.max) ? spec.y.max : Math.max(...ys) + pad(Math.min(...ys), Math.max(...ys));
  const X = v => L + (W - L - R) * (v - x0) / ((x1 - x0) || 1), Y = v => H - B - (H - B - T) * (v - y0) / ((y1 - y0) || 1);
  const fx = spec.x && spec.x.fmt || (v => D(v, 1)), fy = spec.y && spec.y.fmt || (v => D(v, 1));
  niceTicks(y0, y1, 5).filter(v => v >= y0 && v <= y1).forEach(v => { s.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'gl' })); s.appendChild(svgEl('text', { x: L - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, fy(v))); });
  niceTicks(x0, x1, 6).filter(v => v >= x0 && v <= x1).forEach(v => { s.appendChild(svgEl('line', { x1: X(v), x2: X(v), y1: T, y2: H - B, class: 'gl' })); s.appendChild(svgEl('text', { x: X(v), y: H - B + 17, class: 'ax', 'text-anchor': 'middle' }, fx(v))); });
  if (spec.x && spec.x.label) s.appendChild(svgEl('text', { x: L + (W - L - R) / 2, y: H - 8, class: 'axl', 'text-anchor': 'middle' }, spec.x.label));
  if (spec.y && spec.y.label) s.appendChild(svgEl('text', { x: 4, y: 11, class: 'axl' }, spec.y.label));
  const n = pts.length, mx = sum(xs) / n, my = sum(ys) / n; let sxy = 0, sxx = 0, syy = 0; pts.forEach(p => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; });
  const b = sxx ? sxy / sxx : 0, a = my - b * mx, r = (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : NaN;
  if (spec.fit !== false) s.appendChild(svgEl('line', { x1: X(x0), y1: Y(a + b * x0), x2: X(x1), y2: Y(a + b * x1), stroke: cssv('--ink-2'), 'stroke-width': 1.6, 'stroke-dasharray': '6 5', opacity: .8 }));
  (spec.hlines || []).forEach(h => { s.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(h.y), y2: Y(h.y), stroke: cssv('--ink-3'), 'stroke-dasharray': '2 4' })); if (h.label) s.appendChild(svgEl('text', { x: W - R - 4, y: Y(h.y) - 5, class: 'lblm', 'text-anchor': 'end' }, h.label)); });
  (spec.vlines || []).forEach(h => { s.appendChild(svgEl('line', { x1: X(h.x), x2: X(h.x), y1: T, y2: H - B, stroke: cssv('--ink-3'), 'stroke-dasharray': '2 4' })); if (h.label) s.appendChild(svgEl('text', { x: X(h.x) + 4, y: T + 10, class: 'lblm' }, h.label)); });
  pts.forEach(p => { const c = svgEl('circle', { cx: X(p.x), cy: Y(p.y), r: p.r || 5, fill: p.c || cssv('--s1'), 'fill-opacity': p.op || .72, stroke: cssv('--card'), 'stroke-width': 1.5 }); if (p.tip) { c.addEventListener('mousemove', e => showTip(p.tip, e)); c.addEventListener('mouseleave', hideTip); } if (p.onClick) { c.style.cursor = 'pointer'; c.addEventListener('click', p.onClick); } s.appendChild(c); });
  (spec.labels ? pts.filter(p => p.lab).slice(0, spec.labels) : []).forEach(p => s.appendChild(svgEl('text', { x: X(p.x), y: Y(p.y) - 9, class: 'lblm', 'text-anchor': 'middle' }, p.lab)));
  return { r, b, a, n };
}
/* coefficient plot: rows [{l,b,lo,hi,p,shap}] */
function coefPlot(host, rows, spec) {
  spec = spec || {}; const W = 760, rowH = 30, L = 300, R = 120, T = 26; const H = T + rows.length * rowH + 26;
  const s = chartFrame(host, W, H, spec.aria || 'coefficient plot');
  const lim = Math.max(0.2, ...rows.map(r => Math.max(Math.abs(r.lo), Math.abs(r.hi)))) * 1.1;
  const X = v => L + (W - L - R) * (v + lim) / (2 * lim);
  niceTicks(-lim, lim, 6).filter(v => Math.abs(v) <= lim).forEach(v => { s.appendChild(svgEl('line', { x1: X(v), x2: X(v), y1: T - 6, y2: H - 22, class: 'gl' })); s.appendChild(svgEl('text', { x: X(v), y: H - 6, class: 'ax', 'text-anchor': 'middle' }, S(v, 1))); });
  s.appendChild(svgEl('line', { x1: X(0), x2: X(0), y1: T - 6, y2: H - 22, class: 'base' }));
  s.appendChild(svgEl('text', { x: L, y: 12, class: 'lblm' }, spec.head || 'Standardized effect (SD of outcome per SD of predictor), 95% interval'));
  s.appendChild(svgEl('text', { x: W - R + 10, y: 12, class: 'lblm' }, 'p · Shapley R²'));
  rows.forEach((r, i) => { const y = T + i * rowH + rowH / 2; const sig = r.p < 0.05; const col = sig ? (r.b > 0 ? cssv('--heat') : cssv('--cool')) : cssv('--ink-3');
    s.appendChild(svgEl('text', { x: L - 10, y: y + 4, class: 'ax', 'text-anchor': 'end', style: 'fill:' + cssv('--ink-2') }, r.l));
    s.appendChild(svgEl('line', { x1: X(r.lo), x2: X(r.hi), y1: y, y2: y, stroke: col, 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
    s.appendChild(svgEl('circle', { cx: X(r.b), cy: y, r: 5.5, fill: sig ? col : cssv('--card'), stroke: col, 'stroke-width': 2 }));
    s.appendChild(svgEl('text', { x: W - R + 10, y: y + 4, class: 'ax' }, `${r.p < 0.001 ? '<0.001' : D(r.p, 3)} · ${D(r.shap, 3)}`)); });
  return s;
}
function corrMatrix(keys, labels, corr) {
  const cell = v => { const a = Math.abs(v), same = v === 1; const bg = same ? cssv('--sunk') : `color-mix(in srgb, ${v >= 0 ? cssv('--heat') : cssv('--cool')} ${Math.round(a * 70)}%, ${cssv('--card')})`; return `<td style="background:${bg};color:${a > .55 && !same ? '#fff' : 'inherit'}">${same ? '—' : D(v, 2)}</td>`; };
  return `<div class="xscroll"><table class="cm"><thead><tr><th></th>${keys.map(k => `<th>${labels[k]}</th>`).join('')}</tr></thead><tbody>${keys.map(k1 => `<tr><th class="rh">${labels[k1]}</th>${keys.map(k2 => cell(corr[k1][k2])).join('')}</tr>`).join('')}</tbody></table></div>`;
}
