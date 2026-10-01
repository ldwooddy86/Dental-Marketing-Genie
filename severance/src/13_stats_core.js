'use strict';
/* SEV_STATS: the statistics Severance computes in the browser (module 27, Evidence). Plain functions on arrays with no DOM, so the same
   file runs in the page and in node (tests/stats.test.mjs checks it against textbook and hand computed values).
     descriptive    mean(a, w), sd(a, w), median(a), quantile(a, p), ranks(a) (average ranks for ties)
     distributions  normCdf(z), pZ(z) two sided, tCdf(t, df), pT(t, df) two sided, tQuant(p, df), lgamma(x), ibeta(x, a, b)
     correlation    pearson(x, y, w) → {r, n, t, p, lo, hi}; spearman(x, y) → {rho, r, n, t, p}; corr(cols, keys, method) → {k1: {k2: r}}
     regression     ols(y, X, o) → {n, k, df, names, coef: [{name, b, se, t, p, lo, hi}], r2, adjR2, r2fe, sigma, fitted, resid, rows, fe}
                    o: {names, w (weights), fe (a group label per row), feMin (the smallest group that gets its own dummy, default 2),
                        se: 'classic' | 'HC0' | 'HC1' | 'HC3' (default classic), std (z score y and every X column first), r2only}
                    shapley(y, X, o) → {r2, base, gain, phi: [{name, value, share}]}: the exact Shapley split of the R² gained over the
                    fixed effects (every subset of the predictors is fit on the same complete rows; up to 12 predictors)
     spatial        rng(seed) (mulberry32, reproducible), hashSeed(text), knn(points, k), contiguity(paths, tol), subsetW(W, keep), lag(W, z),
                    moran(x, W, {perms, seed}) → {I, EI, VI_norm, VI_rand, z_norm, z_rand, p_norm, p_rand, p_sim, mean_sim, sd_sim, n, perms}
                    localMoran(x, W, {perms, seed, alpha}) → {Is, z, lag, q, p, cls, counts}; localMoranAsync(...) the same in chunks
     survival       survival(h, se, per) → [{t, s, lo, hi}], medianSurvival(curve), medianBands(bands)
   A weights object W is {n, nb: [[j]], w: [[w_ij]]}, row standardized by knn and contiguity. Missing values: correlation and regression
   drop a row where any input is not a finite number (listwise); spatial functions expect complete data (use subsetW first). */
const SEV_STATS = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);

  /* ---- descriptive */
  function mean(a, w) { let s = 0, sw = 0; for (let i = 0; i < a.length; i++) { if (!isNum(a[i])) continue; const wi = w ? w[i] : 1; if (!isNum(wi)) continue; s += wi * a[i]; sw += wi; } return sw ? s / sw : null; }
  function sd(a, w) { const m = mean(a, w); if (m == null) return null; let s = 0, sw = 0, n = 0; for (let i = 0; i < a.length; i++) { if (!isNum(a[i])) continue; const wi = w ? w[i] : 1; if (!isNum(wi)) continue; s += wi * (a[i] - m) ** 2; sw += wi; n++; } return n > 1 ? Math.sqrt(s / sw * n / (n - 1)) : null; }
  function quantile(a, p) { const v = a.filter(isNum).sort((x, y) => x - y); if (!v.length) return null; const h = (v.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return v[lo] + (v[hi] - v[lo]) * (h - lo); }
  const median = a => quantile(a, 0.5);
  function ranks(a) { const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]); const r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; } return r; }

  /* ---- distributions: Lanczos log gamma, the regularized incomplete beta by continued fraction (Numerical Recipes 6.4), erfc from
     the incomplete gamma (full double precision, and tiny p values keep their size) */
  const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) { if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x); x -= 1; let a = LG[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += LG[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }
  function betacf(a, b, x) {
    const FPMIN = 1e-300; const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= 400; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-16) break;
    }
    return h;
  }
  function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  // the regularized upper incomplete gamma Q(a, x) by series or continued fraction (Numerical Recipes 6.2); erfc(x) = Q(1/2, x²)
  function gammq(a, x) {
    if (x <= 0) return 1; const lead = -x + a * Math.log(x) - lgamma(a);
    if (x < a + 1) { let ap = a, s = 1 / a, del = s; for (let i = 1; i < 600; i++) { ap += 1; del *= x / ap; s += del; if (Math.abs(del) < Math.abs(s) * 1e-16) break; } return 1 - s * Math.exp(lead); }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 600; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break; }
    return Math.exp(lead) * h;
  }
  function erfc(x) { const q = gammq(0.5, x * x); return x >= 0 ? q : 2 - q; }
  const normCdf = z => 0.5 * erfc(-z / Math.SQRT2);
  const pZ = z => isNum(z) ? Math.min(1, erfc(Math.abs(z) / Math.SQRT2)) : null;
  function pT(t, df) { if (!isNum(t) || !(df > 0)) return null; return Math.min(1, ibeta(df / (df + t * t), df / 2, 0.5)); }
  function tCdf(t, df) { const tail = 0.5 * ibeta(df / (df + t * t), df / 2, 0.5); return t > 0 ? 1 - tail : tail; }
  function tQuant(p, df) { if (!(p > 0 && p < 1) || !(df > 0)) return null; let lo = -1e4, hi = 1e4; for (let i = 0; i < 120; i++) { const m = (lo + hi) / 2; if (tCdf(m, df) < p) lo = m; else hi = m; } return (lo + hi) / 2; }

  /* ---- correlation. Weighted r takes its t and p from the number of pairs (an approximation the module states). */
  function pearson(x, y, w) {
    const ix = []; for (let i = 0; i < x.length; i++) if (isNum(x[i]) && isNum(y[i]) && (!w || (isNum(w[i]) && w[i] > 0))) ix.push(i);
    const n = ix.length; const out = { r: null, n, t: null, p: null, lo: null, hi: null }; if (n < 3) return out;
    let sw = 0, mx = 0, my = 0; ix.forEach(i => { const wi = w ? w[i] : 1; sw += wi; mx += wi * x[i]; my += wi * y[i]; }); mx /= sw; my /= sw;
    let sxy = 0, sxx = 0, syy = 0; ix.forEach(i => { const wi = w ? w[i] : 1; sxy += wi * (x[i] - mx) * (y[i] - my); sxx += wi * (x[i] - mx) ** 2; syy += wi * (y[i] - my) ** 2; });
    if (!(sxx > 0 && syy > 0)) return out;
    const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))); out.r = r;
    if (Math.abs(r) >= 1) { out.t = r > 0 ? Infinity : -Infinity; out.p = 0; out.lo = out.hi = r; return out; }
    out.t = r * Math.sqrt((n - 2) / (1 - r * r)); out.p = pT(out.t, n - 2);
    if (n > 3) { const zr = Math.atanh(r), s = 1 / Math.sqrt(n - 3); out.lo = Math.tanh(zr - 1.959964 * s); out.hi = Math.tanh(zr + 1.959964 * s); }
    return out;
  }
  function spearman(x, y) {
    const ix = []; for (let i = 0; i < x.length; i++) if (isNum(x[i]) && isNum(y[i])) ix.push(i);
    const rx = ranks(ix.map(i => x[i])), ry = ranks(ix.map(i => y[i])); const r = pearson(rx, ry);
    return { rho: r.r, r: r.r, n: ix.length, t: r.t, p: r.p };
  }
  function corr(cols, keys, method) { const out = {}; keys.forEach(a => { out[a] = {}; keys.forEach(b => { out[a][b] = a === b ? 1 : (method === 'spearman' ? spearman(cols[a], cols[b]).rho : pearson(cols[a], cols[b]).r); }); }); return out; }

  /* ---- linear algebra: the inverse of a symmetric matrix by Gauss Jordan with partial pivoting on its scaled (unit diagonal) form, so
     collinearity is caught by one threshold whatever the units; null when singular */
  function invSym(A) {
    const n = A.length; const s = A.map((r, i) => r[i] > 0 ? 1 / Math.sqrt(r[i]) : 0); if (s.some(v => !v)) return null;
    const M = A.map((r, i) => r.map((v, j) => v * s[i] * s[j]).concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-10) return null;
      if (p !== c) { const t = M[p]; M[p] = M[c]; M[c] = t; }
      const pv = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= pv;
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c]; if (!f) continue; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map((r, i) => r.slice(n).map((v, j) => v * s[i] * s[j]));
  }

  /* ---- ordinary (or weighted) least squares with an intercept, optional fixed effects and classic or heteroskedasticity robust errors */
  function completeRows(y, X, o) { const rows = []; for (let i = 0; i < y.length; i++) { if (!isNum(y[i]) || !X[i] || !X[i].every(isNum)) continue; if (o.w && !(isNum(o.w[i]) && o.w[i] > 0)) continue; if (o.fe && (o.fe[i] == null || o.fe[i] === '')) continue; rows.push(i); } return rows; }
  function zcols(rows, y, X, w) {
    const ws = w ? rows.map(i => w[i]) : null; const yy = rows.map(i => y[i]); const my = mean(yy, ws), sy = sd(yy, ws);
    const p = rows.length ? X[rows[0]].length : 0; const ms = [], ss = [];
    for (let j = 0; j < p; j++) { const c = rows.map(i => X[i][j]); ms.push(mean(c, ws)); ss.push(sd(c, ws)); }
    return { y: yy.map(v => sy ? (v - my) / sy : 0), X: rows.map(i => X[i].map((v, j) => ss[j] ? (v - ms[j]) / ss[j] : 0)), my, sy, ms, ss };
  }
  function feDummies(labels, feMin) {
    const cnt = new Map(); labels.forEach(g => cnt.set(g, (cnt.get(g) || 0) + 1));
    const own = [...cnt.keys()].filter(g => cnt.get(g) >= feMin).sort((a, b) => cnt.get(b) - cnt.get(a) || String(a).localeCompare(String(b)));
    // the largest eligible group (or the pooled small groups when there are any) is the reference
    const pooled = [...cnt.keys()].filter(g => cnt.get(g) < feMin);
    const dummies = pooled.length ? own : own.slice(1);
    return { groups: [...cnt.keys()].length, own: own.length, pooled: pooled.length, ref: pooled.length ? 'pooled small groups' : own[0], dummies };
  }
  function fit(Z, yv, wv, wantSE, seType) {
    const n = Z.length, k = Z[0].length; const XtX = Array.from({ length: k }, () => new Array(k).fill(0)); const Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) { const zi = Z[i], wi = wv ? wv[i] : 1; for (let a = 0; a < k; a++) { const za = zi[a] * wi; if (!za) continue; Xty[a] += za * yv[i]; for (let b = a; b < k; b++) XtX[a][b] += za * zi[b]; } }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const Inv = invSym(XtX); if (!Inv) return null;
    const b = Inv.map(r => r.reduce((s, v, j) => s + v * Xty[j], 0));
    const fitted = Z.map(zi => zi.reduce((s, v, j) => s + v * b[j], 0)); const resid = yv.map((v, i) => v - fitted[i]);
    let sw = 0, my = 0; for (let i = 0; i < n; i++) { const wi = wv ? wv[i] : 1; sw += wi; my += wi * yv[i]; } my /= sw;
    let rss = 0, tss = 0; for (let i = 0; i < n; i++) { const wi = wv ? wv[i] : 1; rss += wi * resid[i] ** 2; tss += wi * (yv[i] - my) ** 2; }
    const out = { b, fitted, resid, rss, tss, r2: tss > 0 ? 1 - rss / tss : null, n, k };
    if (!wantSE) return out;
    const df = n - k; const s2 = df > 0 ? rss / df : NaN; let V;
    if (!seType || seType === 'classic') V = Inv.map(r => r.map(v => v * s2));
    else {
      const meat = Array.from({ length: k }, () => new Array(k).fill(0));
      for (let i = 0; i < n; i++) {
        const wi = wv ? wv[i] : 1; const xi = Z[i].map(v => v * Math.sqrt(wi)); const ei = resid[i] * Math.sqrt(wi); let e2 = ei * ei;
        if (seType === 'HC3') { let h = 0; for (let a = 0; a < k; a++) { if (!xi[a]) continue; let t = 0; for (let c = 0; c < k; c++) t += Inv[a][c] * xi[c]; h += xi[a] * t; } e2 = h < 1 - 1e-12 ? e2 / ((1 - h) ** 2) : e2; }
        for (let a = 0; a < k; a++) { if (!xi[a]) continue; for (let c = 0; c < k; c++) meat[a][c] += xi[a] * xi[c] * e2; }
      }
      const AM = Inv.map(r => meat[0].map((_, c) => r.reduce((s, v, j) => s + v * meat[j][c], 0)));
      V = AM.map(r => Inv[0].map((_, c) => r.reduce((s, v, j) => s + v * Inv[j][c], 0)));
      if (seType === 'HC1' && df > 0) V = V.map(r => r.map(v => v * n / df));
    }
    out.V = V; out.df = df; out.sigma = Math.sqrt(s2);
    return out;
  }
  function ols(y, X, o) {
    o = o || {}; const rows = completeRows(y, X, o); const p = rows.length ? X[rows[0]].length : (o.names ? o.names.length : 0);
    const names = (o.names || []).slice(0, p); while (names.length < p) names.push('x' + (names.length + 1));
    if (rows.length < 3) throw new Error(`Too few complete rows to fit (${rows.length}).`);
    let yv, Xv, zinfo = null;
    if (o.std) { zinfo = zcols(rows, y, X, o.w); yv = zinfo.y; Xv = zinfo.X; } else { yv = rows.map(i => y[i]); Xv = rows.map(i => X[i].slice()); }
    const wv = o.w ? rows.map(i => o.w[i]) : null;
    let fe = null, D = rows.map(() => []);
    if (o.fe) { const lab = rows.map(i => o.fe[i]); fe = feDummies(lab, o.feMin || 2); D = lab.map(g => fe.dummies.map(d => (g === d ? 1 : 0))); }
    const Z = rows.map((_, r) => [1].concat(Xv[r], D[r]));
    const k = Z[0].length; if (rows.length <= k) throw new Error(`Too few rows (${rows.length}) for ${k} parameters.`);
    const f = fit(Z, yv, wv, !o.r2only, o.se); if (!f) throw new Error('The predictors are collinear (one is a combination of the others); drop one.');
    const out = { n: f.n, k: f.k, names, r2: f.r2, adjR2: f.r2 == null ? null : 1 - (1 - f.r2) * (f.n - 1) / (f.n - f.k), rows, fe, std: zinfo, rss: f.rss, tss: f.tss };
    if (fe && fe.dummies.length) { const ff = fit(rows.map((_, r) => [1].concat(D[r])), yv, wv, false); out.r2fe = ff ? ff.r2 : null; } else out.r2fe = 0;
    if (o.r2only) return out;
    out.df = f.df; out.sigma = f.sigma; out.fitted = f.fitted; out.resid = f.resid;
    const tc = f.df > 0 ? tQuant(0.975, f.df) : null;
    const coefOf = (j, name) => { const b = f.b[j], se = Math.sqrt(Math.max(0, f.V[j][j])); const t = se > 0 ? b / se : null; return { name, b, se, t, p: t == null ? null : pT(t, f.df), lo: tc == null ? null : b - tc * se, hi: tc == null ? null : b + tc * se }; };
    out.intercept = coefOf(0, '(intercept)');
    out.coef = names.map((nm, j) => coefOf(j + 1, nm));
    return out;
  }
  /* Shapley R²: phi_j = Σ over subsets S without j of |S|! (p − |S| − 1)! / p! × [R²(S ∪ j) − R²(S)]; R²(∅) is the fixed effects alone */
  function shapley(y, X, o) {
    o = Object.assign({}, o || {}); const rows = completeRows(y, X, o); const p = rows.length ? X[rows[0]].length : 0; const names = (o.names || []).slice(0, p); while (names.length < p) names.push('x' + (names.length + 1));
    if (p > 12) throw new Error('Shapley over more than 12 predictors is too slow here.');
    const yy = rows.map(i => y[i]), XX = rows.map(i => X[i]); const sub = Object.assign({}, o, { r2only: true, std: false, w: o.w ? rows.map(i => o.w[i]) : null, fe: o.fe ? rows.map(i => o.fe[i]) : null, names: null });
    const R = new Array(1 << p).fill(0); const fact = [1]; for (let i = 1; i <= p; i++) fact[i] = fact[i - 1] * i;
    for (let m = 0; m < (1 << p); m++) {
      const cols = []; for (let j = 0; j < p; j++) if (m & (1 << j)) cols.push(j);
      if (!cols.length) { if (o.fe) { const r = ols(yy, XX.map(() => []), sub); R[m] = r.r2fe || 0; } else R[m] = 0; continue; }
      R[m] = ols(yy, XX.map(r => cols.map(j => r[j])), sub).r2;
    }
    const phi = names.map((nm, j) => { let v = 0; for (let m = 0; m < (1 << p); m++) { if (m & (1 << j)) continue; let s = 0; for (let t = 0; t < p; t++) if (m & (1 << t)) s++; v += fact[s] * fact[p - s - 1] / fact[p] * (R[m | (1 << j)] - R[m]); } return { name: nm, value: v }; });
    const gain = R[(1 << p) - 1] - R[0]; phi.forEach(f => { f.share = gain ? f.value / gain : null; });
    return { r2: R[(1 << p) - 1], base: R[0], gain, phi, n: rows.length };
  }

  /* ---- spatial: a seeded generator so every permutation test reproduces, weights, Moran's I and local Moran (LISA) */
  function rng(seed) { let a = (seed >>> 0) || 0x9e3779b9; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashSeed(s) { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  const rowStd = nb => nb.map(js => js.map(() => (js.length ? 1 / js.length : 0)));
  function knn(pts, k) {
    const n = pts.length; const nb = pts.map((p, i) => { if (!p) return []; const d = []; for (let j = 0; j < n; j++) { if (j === i || !pts[j]) continue; d.push([(pts[j][0] - p[0]) ** 2 + (pts[j][1] - p[1]) ** 2, j]); } d.sort((a, b) => a[0] - b[0] || a[1] - b[1]); return d.slice(0, k).map(x => x[1]); });
    return { n, nb, w: rowStd(nb), kind: 'knn', k };
  }
  // contiguity from outlines: two areas are neighbors when a vertex of one lies within tol of an edge of the other (shared borders that a
  // simplifier moved apart still meet; a corner touch counts, as in queen contiguity). paths: SVG path data with absolute M/L/Z pairs.
  function rings(d) { const out = []; String(d || '').split(/(?=[Mm])/).forEach(seg => { const n = seg.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) || []; const r = []; for (let i = 0; i + 1 < n.length; i += 2) r.push([+n[i], +n[i + 1]]); if (r.length > 1) { r.push(r[0]); out.push(r); } }); return out; }
  function contiguity(paths, tol) {
    tol = tol == null ? 1 : tol; const n = paths.length; const R = paths.map(rings); const cell = Math.max(tol * 2, 4); const grid = new Map();
    R.forEach((rs, id) => rs.forEach(r => { for (let i = 0; i + 1 < r.length; i++) { const a = r[i], b = r[i + 1]; const x0 = Math.floor((Math.min(a[0], b[0]) - tol) / cell), x1 = Math.floor((Math.max(a[0], b[0]) + tol) / cell), y0 = Math.floor((Math.min(a[1], b[1]) - tol) / cell), y1 = Math.floor((Math.max(a[1], b[1]) + tol) / cell); for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; let g = grid.get(k); if (!g) grid.set(k, g = []); g.push([id, a, b]); } } }));
    const d2 = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]; return x * x + y * y; };
    const sets = R.map(() => new Set());
    R.forEach((rs, id) => rs.forEach(r => r.forEach(p => { const cand = grid.get(Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell)); if (!cand) return; for (const [j, a, b] of cand) { if (j === id || sets[id].has(j)) continue; if (d2(p, a, b) <= tol * tol) { sets[id].add(j); sets[j].add(id); } } })));
    const nb = sets.map(s => [...s].sort((a, b) => a - b));
    return { n, nb, w: rowStd(nb), kind: 'contiguity', tol };
  }
  // keep only the rows marked true (areas with data); neighbors outside are dropped and the weights row standardized again; an area left
  // with no neighbor (an island) is removed too and listed, by its original index
  function subsetW(W, keep) {
    let ok = keep.slice(); let islands = [];
    for (let pass = 0; pass < 5; pass++) { const add = []; for (let i = 0; i < W.n; i++) if (ok[i] && !W.nb[i].some(j => ok[j])) add.push(i); if (!add.length) break; add.forEach(i => { ok[i] = false; }); islands = islands.concat(add); }
    const idx = []; const map = new Array(W.n).fill(-1); for (let i = 0; i < W.n; i++) if (ok[i]) { map[i] = idx.length; idx.push(i); }
    const nb = idx.map(i => W.nb[i].filter(j => ok[j]).map(j => map[j]));
    return { n: idx.length, nb, w: rowStd(nb), idx, islands, kind: W.kind, k: W.k, tol: W.tol };
  }
  function lag(W, z) { return W.nb.map((js, i) => { let s = 0; for (let t = 0; t < js.length; t++) s += W.w[i][t] * z[js[t]]; return s; }); }
  function wStats(W) {
    const n = W.n; let S0 = 0; const rowS = new Array(n).fill(0), colS = new Array(n).fill(0); const pair = new Map();
    for (let i = 0; i < n; i++) W.nb[i].forEach((j, t) => { const v = W.w[i][t]; S0 += v; rowS[i] += v; colS[j] += v; const key = i < j ? i * n + j : j * n + i; pair.set(key, (pair.get(key) || 0) + v); });
    let S1 = 0; pair.forEach(v => { S1 += 2 * v * v; }); S1 *= 0.5;
    let S2 = 0; for (let i = 0; i < n; i++) S2 += (rowS[i] + colS[i]) ** 2;
    return { S0, S1, S2 };
  }
  function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const fold = (larger, perms) => ((perms - larger) < larger ? perms - larger : larger);
  function moran(x, W, o) {
    o = o || {}; const n = x.length; if (n !== W.n) throw new Error('moran: the data and the weights differ in length');
    const m = x.reduce((a, b) => a + b, 0) / n; const z = x.map(v => v - m); const m2 = z.reduce((a, v) => a + v * v, 0); const m4 = z.reduce((a, v) => a + v ** 4, 0);
    const { S0, S1, S2 } = wStats(W); const Ival = zz => { const L = lag(W, zz); let s = 0; for (let i = 0; i < n; i++) s += zz[i] * L[i]; return n / S0 * s / m2; };
    const I = Ival(z); const EI = -1 / (n - 1);
    const VI_norm = (n * n * S1 - n * S2 + 3 * S0 * S0) / ((n * n - 1) * S0 * S0) - EI * EI;
    const b2 = n * m4 / (m2 * m2);
    const VI_rand = (n * ((n * n - 3 * n + 3) * S1 - n * S2 + 3 * S0 * S0) - b2 * ((n * n - n) * S1 - 2 * n * S2 + 6 * S0 * S0)) / ((n - 1) * (n - 2) * (n - 3) * S0 * S0) - EI * EI;
    const out = { n, I, EI, VI_norm, VI_rand, z_norm: (I - EI) / Math.sqrt(VI_norm), z_rand: (I - EI) / Math.sqrt(VI_rand) };
    out.p_norm = pZ(out.z_norm); out.p_rand = pZ(out.z_rand);
    const perms = o.perms == null ? 999 : o.perms; out.perms = perms;
    if (perms > 0) {
      const r = rng(o.seed == null ? 12345 : o.seed); const zz = z.slice(); let larger = 0, s = 0, ss = 0;
      for (let p = 0; p < perms; p++) { shuffle(zz, r); const v = Ival(zz); if (v >= I) larger++; s += v; ss += v * v; }
      out.p_sim = (fold(larger, perms) + 1) / (perms + 1); out.mean_sim = s / perms; out.sd_sim = Math.sqrt(Math.max(0, ss / perms - (s / perms) ** 2)); out.z_sim = out.sd_sim ? (I - out.mean_sim) / out.sd_sim : null;
    }
    return out;
  }
  /* local Moran (Anselin 1995) as PySAL computes it: z standardized by the population sd, I_i = (n − 1) z_i lag_i / Σz², conditional
     permutation (z_i held, its neighbors drawn from the other n − 1 values), folded pseudo p = (extreme + 1) / (perms + 1). Each area
     draws from its own generator seeded by (seed, index), so a chunked run gives the same answer as a single pass. */
  function lisaPrep(x, W) {
    const n = x.length; if (n !== W.n) throw new Error('localMoran: the data and the weights differ in length');
    const m = x.reduce((a, b) => a + b, 0) / n; const s = Math.sqrt(x.reduce((a, v) => a + (v - m) ** 2, 0) / n) || 1;
    const z = x.map(v => (v - m) / s); const den = z.reduce((a, v) => a + v * v, 0); const L = lag(W, z);
    const Is = z.map((v, i) => (n - 1) * v * L[i] / den);
    const q = z.map((v, i) => (v > 0 ? (L[i] > 0 ? 'HH' : 'HL') : (L[i] > 0 ? 'LH' : 'LL')));
    return { n, z, den, lag: L, Is, q, p: new Array(n).fill(null), cls: new Array(n).fill('ns') };
  }
  function lisaRow(S, W, i, perms, seed) {
    const n = S.n, js = W.nb[i], k = js.length; if (!k) return 1;
    const r = rng((seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0); let larger = 0; const pick = new Array(k);
    const pool = k > n / 4 ? Array.from({ length: n }, (_, t) => t).filter(t => t !== i) : null;
    for (let p = 0; p < perms; p++) {
      if (pool) { for (let t = 0; t < k; t++) { const j = t + Math.floor(r() * (pool.length - t)); const tmp = pool[t]; pool[t] = pool[j]; pool[j] = tmp; pick[t] = pool[t]; } }
      else { for (let t = 0; t < k;) { const c = Math.floor(r() * n); if (c === i) continue; let dup = false; for (let u = 0; u < t; u++) if (pick[u] === c) { dup = true; break; } if (dup) continue; pick[t++] = c; } }
      let lg = 0; for (let t = 0; t < k; t++) lg += W.w[i][t] * S.z[pick[t]];
      if ((n - 1) * S.z[i] * lg / S.den >= S.Is[i]) larger++;
    }
    return (fold(larger, perms) + 1) / (perms + 1);
  }
  function lisaDone(S, alpha) { const counts = { HH: 0, LL: 0, HL: 0, LH: 0, ns: 0 }; S.cls = S.p.map((p, i) => (p != null && p <= alpha ? S.q[i] : 'ns')); S.cls.forEach(c => { counts[c]++; }); S.counts = counts; S.alpha = alpha; return S; }
  function localMoran(x, W, o) {
    o = o || {}; const perms = o.perms == null ? 499 : o.perms, seed = o.seed == null ? 12345 : o.seed; const S = lisaPrep(x, W);
    for (let i = 0; i < S.n; i++) S.p[i] = lisaRow(S, W, i, perms, seed);
    S.perms = perms; return lisaDone(S, o.alpha == null ? 0.05 : o.alpha);
  }
  // the same in chunks of rows between timer ticks, so a page stays responsive; onProgress(done, n) after each chunk
  function localMoranAsync(x, W, o, onProgress) {
    o = o || {}; const perms = o.perms == null ? 499 : o.perms, seed = o.seed == null ? 12345 : o.seed; const chunk = o.chunk || 32; const S = lisaPrep(x, W); S.perms = perms;
    return new Promise((res, rej) => { let i = 0; const step = () => { try { const end = Math.min(S.n, i + chunk); for (; i < end; i++) S.p[i] = lisaRow(S, W, i, perms, seed); if (onProgress) onProgress(i, S.n); if (i < S.n) setTimeout(step, 0); else res(lisaDone(S, o.alpha == null ? 0.05 : o.alpha)); } catch (e) { rej(e); } }; setTimeout(step, 0); });
  }

  /* ---- survival from annual hazards: S(t) = Π (1 − h_d / per) over the years before t; the 95% band from the hazards' standard errors
     by the delta method on log S (Greenwood's form), years treated as independent samples */
  function survival(h, se, per) {
    per = per || 1000; const out = [{ t: 0, s: 1, lo: 1, hi: 1 }]; let s = 1, v = 0;
    for (let i = 0; i < h.length; i++) { const q = h[i] / per; s *= 1 - q; const sq = (se && isNum(se[i]) ? se[i] : 0) / per; v += sq * sq / ((1 - q) * (1 - q)); const k = 1.959964 * Math.sqrt(v); out.push({ t: i + 1, s, lo: s * Math.exp(-k), hi: Math.min(1, s * Math.exp(k)) }); }
    return out;
  }
  function medianSurvival(curve) { for (let i = 1; i < curve.length; i++) if (curve[i].s <= 0.5) { const a = curve[i - 1], b = curve[i]; return a.t + (a.s - 0.5) / (a.s - b.s) * (b.t - a.t); } return null; }
  // the median of a banded distribution, linear within the band that holds it: bands [{lo, hi, w}] in order, the last may be open (hi null)
  function medianBands(bands) { const tot = bands.reduce((a, b) => a + (b.w || 0), 0); if (!tot) return null; let acc = 0; for (const b of bands) { if (acc + b.w >= tot / 2) { if (b.hi == null) return null; return b.lo + (tot / 2 - acc) / b.w * (b.hi - b.lo); } acc += b.w; } return null; }

  return { isNum, mean, sd, median, quantile, ranks, lgamma, ibeta, erfc, normCdf, pZ, pT, tCdf, tQuant, pearson, spearman, corr, invSym, ols, shapley,
    rng, hashSeed, knn, contiguity, subsetW, lag, moran, localMoran, localMoranAsync, survival, medianSurvival, medianBands };
})();
