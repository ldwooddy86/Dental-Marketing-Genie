/* SEV_STATS (src/13_stats_core.js) against textbook and hand computed values: Anscombe's quartet (set I) for Pearson r and OLS with its
   standard errors, the Spearman example of the IQ and television hours table, t and normal quantiles, an exact two predictor fit, fixed
   effects against the within estimator, White's robust variance by hand, Shapley R² by its definition, Moran's I on a path and a
   checkerboard (with the analytic variance worked by hand), the permutation distribution against the randomization variance, local Moran
   identities and reproducibility, k nearest neighbors, contiguity from outlines, survival and banded medians. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assert, eq } from './lib/mock.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, setTimeout, clearTimeout }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/13_stats_core.js'), 'utf8'), ctx, { filename: 'src/13_stats_core.js' });
const S = vm.runInContext('SEV_STATS', ctx);
const near = (a, b, tol, msg) => assert(typeof a === 'number' && Math.abs(a - b) <= tol, `${msg}: expected ${b} ± ${tol}, got ${a}`);
let n = 0; const t = (name, fn) => { fn(); n++; };

/* ---- distributions */
t('distributions', () => {
  near(S.normCdf(1.959964), 0.975, 2e-7, 'normCdf(1.96)');
  near(S.pZ(1.959964), 0.05, 4e-7, 'two sided p at z 1.96');
  near(S.normCdf(0), 0.5, 1e-9, 'normCdf(0)');
  near(S.tCdf(1, 1), 0.75, 1e-10, 'Cauchy: P(T < 1) with 1 df is 3/4');
  near(S.tQuant(0.975, 10), 2.228139, 1e-5, 't critical value, 10 df');
  near(S.tQuant(0.975, 9), 2.262157, 1e-5, 't critical value, 9 df');
  near(S.pT(2.228139, 10), 0.05, 1e-6, 'two sided p at the 10 df critical value');
  near(S.lgamma(5), Math.log(24), 1e-10, 'log gamma(5) = log 4!');
  near(S.lgamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-10, 'log gamma(1/2)');
  near(S.ibeta(0.5, 2, 2), 0.5, 1e-12, 'regularized incomplete beta is symmetric at one half');
  near(S.ibeta(0.3, 1, 1), 0.3, 1e-12, 'I_x(1,1) = x');
  assert(S.pT(12, 1000) < 1e-25 && S.pT(12, 1000) > 0, 'tiny p values keep their size');
});

/* ---- Anscombe (1973), set I: r 0.816, y = 3.0001 + 0.5001 x, SE 1.1247 and 0.1179, R² 0.6665, p 0.00217 (the standard R output) */
const ax = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5], ay = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
t('pearson and ols on Anscombe I', () => {
  const r = S.pearson(ax, ay); near(r.r, 0.81642, 1e-5, 'Anscombe r'); eq(r.n, 11, 'n'); near(r.p, 0.00217, 2e-5, 'p of r');
  assert(r.lo < r.r && r.hi > r.r && r.hi < 1, 'Fisher interval brackets r');
  const m = S.ols(ay, ax.map(v => [v]), { names: ['x'] });
  near(m.intercept.b, 3.0001, 1e-4, 'intercept'); near(m.coef[0].b, 0.5001, 1e-4, 'slope');
  near(m.intercept.se, 1.1247, 1e-4, 'SE intercept'); near(m.coef[0].se, 0.1179, 1e-4, 'SE slope');
  near(m.coef[0].t, 4.241, 1e-3, 't slope'); near(m.coef[0].p, 0.00217, 2e-5, 'p slope'); near(m.intercept.p, 0.02573, 2e-5, 'p intercept');
  near(m.r2, 0.6665, 1e-4, 'R²'); near(m.adjR2, 0.6295, 1e-4, 'adjusted R²'); near(m.sigma, 1.237, 1e-3, 'residual SE'); eq(m.df, 9, 'df');
  near(m.coef[0].lo, 0.5001 - 2.262157 * 0.1179, 2e-4, '95% interval uses t with 9 df');
  // a standardized simple regression slope is r
  near(S.ols(ay, ax.map(v => [v]), { std: true }).coef[0].b, 0.81642, 1e-5, 'standardized slope = r');
  // equal weights change nothing
  near(S.pearson(ax, ay, ax.map(() => 3)).r, r.r, 1e-12, 'equal weights'); near(S.ols(ay, ax.map(v => [v]), { w: ax.map(() => 2) }).coef[0].se, 0.1179, 1e-4, 'equal weights, SE');
  // a missing value drops its row
  eq(S.pearson(ax.concat([null]), ay.concat([3])).n, 11, 'listwise');
});

/* ---- Spearman: the IQ and hours of television example, rho = −29/165, p 0.627 with the t approximation */
t('spearman', () => {
  const iq = [106, 100, 86, 101, 99, 103, 97, 113, 112, 110], tv = [7, 27, 2, 50, 28, 29, 20, 12, 6, 17];
  const s = S.spearman(iq, tv); near(s.rho, -29 / 165, 1e-12, 'rho'); near(s.p, 0.627188, 1e-4, 'p');
  // ties take average ranks: x ranks 1, 2.5, 2.5, 4 against 1..4 gives 4.5 / sqrt(22.5)
  near(S.spearman([1, 2, 2, 3], [1, 2, 3, 4]).rho, 4.5 / Math.sqrt(22.5), 1e-12, 'ties');
  eq(S.ranks([3, 1, 2, 2]), [4, 1, 2.5, 2.5], 'ranks');
});

/* ---- multiple regression: an exact fit, fixed effects, robust errors */
t('ols exact, fixed effects, robust', () => {
  const X = [[1, 2], [2, 1], [3, 5], [4, 2], [5, 7], [6, 1]]; const y = X.map(r => 1 + 2 * r[0] - 3 * r[1]);
  const m = S.ols(y, X, { names: ['a', 'b'] }); near(m.intercept.b, 1, 1e-10, 'exact intercept'); near(m.coef[0].b, 2, 1e-10, 'exact a'); near(m.coef[1].b, -3, 1e-10, 'exact b'); near(m.r2, 1, 1e-12, 'R² 1');
  // two groups with their own levels: the dummy regression slope equals the within (demeaned) slope worked by hand
  const g = ['A', 'A', 'A', 'B', 'B', 'B', 'B'], x = [1, 2, 4, 2, 3, 5, 6], yy = [3, 4, 7, 12, 12.5, 15, 17];
  const dm = (v) => { const mA = (v[0] + v[1] + v[2]) / 3, mB = (v[3] + v[4] + v[5] + v[6]) / 4; return v.map((u, i) => u - (i < 3 ? mA : mB)); };
  const xd = dm(x), yd = dm(yy); const within = xd.reduce((s, v, i) => s + v * yd[i], 0) / xd.reduce((s, v) => s + v * v, 0);
  const f = S.ols(yy, x.map(v => [v]), { fe: g }); near(f.coef[0].b, within, 1e-10, 'fixed effects slope = within slope'); eq(f.fe.dummies.length, 1, 'one dummy for two groups'); assert(f.r2fe > 0.8 && f.r2fe < f.r2, 'fixed effects alone explain less than the full model');
  // a group below feMin is pooled into the reference
  const f2 = S.ols(yy.concat([9]), x.concat([3]).map(v => [v]), { fe: g.concat(['C']) }); eq(f2.fe.pooled, 1, 'single row group pooled'); eq(f2.fe.dummies.length, 2, 'A and B keep dummies against the pooled reference');
  // White (HC0) for a simple regression: Σ (x − x̄)² e² / (Σ (x − x̄)²)², HC1 scales by n / (n − 2)
  const ols0 = S.ols(ay, ax.map(v => [v]), { se: 'HC0' }); const mx = ax.reduce((a, b) => a + b, 0) / ax.length; const e = ols0.resid; const sxx = ax.reduce((s, v) => s + (v - mx) ** 2, 0);
  const white = ax.reduce((s, v, i) => s + (v - mx) ** 2 * e[i] ** 2, 0) / (sxx * sxx); near(ols0.coef[0].se, Math.sqrt(white), 1e-12, 'HC0 = White by hand');
  near(S.ols(ay, ax.map(v => [v]), { se: 'HC1' }).coef[0].se, Math.sqrt(white * 11 / 9), 1e-12, 'HC1');
  const h3 = S.ols(ay, ax.map(v => [v]), { se: 'HC3' }).coef[0].se; assert(h3 > Math.sqrt(white), 'HC3 is larger than HC0');
  // collinear predictors are refused with a message
  let msg = ''; try { S.ols(y, X.map(r => [r[0], 2 * r[0]])); } catch (err) { msg = err.message; } assert(/collinear/.test(msg), 'collinearity message');
});

/* ---- Shapley R² by definition */
t('shapley', () => {
  const x1 = [1, 2, 3, 4, 5, 6, 7, 8], x2 = [2, 1, 4, 3, 6, 5, 8, 9], y = [1.2, 1.9, 3.6, 3.8, 5.9, 5.5, 8.1, 8.7];
  const X = x1.map((v, i) => [v, x2[i]]); const sh = S.shapley(y, X, { names: ['x1', 'x2'] });
  const r1 = S.ols(y, x1.map(v => [v])).r2, r2 = S.ols(y, x2.map(v => [v])).r2, r12 = S.ols(y, X).r2;
  near(sh.phi[0].value, 0.5 * r1 + 0.5 * (r12 - r2), 1e-12, 'phi x1'); near(sh.phi[1].value, 0.5 * r2 + 0.5 * (r12 - r1), 1e-12, 'phi x2');
  near(sh.phi[0].value + sh.phi[1].value, r12, 1e-12, 'shares add to R²'); near(sh.phi[0].share + sh.phi[1].share, 1, 1e-12, 'shares add to 1');
  // orthogonal predictors: each keeps its own R²
  const o1 = [1, -1, 1, -1], o2 = [1, 1, -1, -1], yo = [3, 1, 0.5, -1.5]; const so = S.shapley(yo, o1.map((v, i) => [v, o2[i]]));
  near(so.phi[0].value, S.ols(yo, o1.map(v => [v])).r2, 1e-12, 'orthogonal x1'); near(so.phi[1].value, S.ols(yo, o2.map(v => [v])).r2, 1e-12, 'orthogonal x2');
  // with fixed effects the split covers only what the predictors add beyond them
  const g = ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'b']; const sf = S.shapley(y, X, { fe: g }); near(sf.base + sf.gain, sf.r2, 1e-12, 'base plus gain'); near(sf.phi[0].value + sf.phi[1].value, sf.gain, 1e-12, 'fixed effects shares');
});

/* ---- Moran's I */
const W = (nb, binary) => ({ n: nb.length, nb, w: nb.map(js => js.map(() => (binary ? 1 : 1 / js.length))) });
const path4 = [[1], [0, 2], [1, 3], [2]];
const grid = (r, c, rook) => { const nb = []; for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) { const a = []; [[-1, 0], [1, 0], [0, -1], [0, 1]].concat(rook ? [] : [[-1, -1], [-1, 1], [1, -1], [1, 1]]).forEach(([di, dj]) => { const ii = i + di, jj = j + dj; if (ii >= 0 && ii < r && jj >= 0 && jj < c) a.push(ii * c + jj); }); nb.push(a); } return nb; };
t('moran', () => {
  const x = [1, 2, 3, 4];
  const m = S.moran(x, W(path4), { perms: 0 }); near(m.I, 0.4, 1e-12, 'path, row standardized: I = 2/5'); near(m.EI, -1 / 3, 1e-12, 'E[I] = −1/(n − 1)');
  const b = S.moran(x, W(path4, true), { perms: 0 }); near(b.I, 1 / 3, 1e-12, 'path, binary: I = 4/6 × 2.5/5');
  near(b.VI_norm, 4 / 27, 1e-12, 'variance under normality by hand: (16·12 − 4·40 + 3·36)/(15·36) − 1/9');
  // checkerboard on a rook grid: every neighbor differs, I = −1
  const nb = grid(4, 4, true); const cb = Array.from({ length: 16 }, (_, k) => (Math.floor(k / 4) + k % 4) % 2);
  near(S.moran(cb, W(nb), { perms: 0 }).I, -1, 1e-12, 'checkerboard');
  // the permutation distribution centers on E[I] with the randomization variance (10 by 10 queen grid, 4,999 draws)
  const g = grid(10, 10, false); const r = S.rng(7); const v = Array.from({ length: 100 }, () => r() * 10 + (r() < 0.2 ? 20 : 0));
  const mm = S.moran(v, W(g), { perms: 4999, seed: 99 });
  near(mm.mean_sim, mm.EI, 0.004, 'permutation mean ≈ E[I]'); near(mm.sd_sim * mm.sd_sim / mm.VI_rand, 1, 0.08, 'permutation variance ≈ randomization variance');
  // reproducible with the same seed, different with another
  eq(S.moran(v, W(g), { perms: 199, seed: 5 }).p_sim, S.moran(v, W(g), { perms: 199, seed: 5 }).p_sim, 'same seed, same p');
  assert(S.moran(v, W(g), { perms: 199, seed: 5 }).mean_sim !== S.moran(v, W(g), { perms: 199, seed: 6 }).mean_sim, 'another seed, other draws');
  // a strong gradient is significant; a pseudo p is never below 1 / (perms + 1)
  const grad = Array.from({ length: 100 }, (_, k) => Math.floor(k / 10) + (k % 10)); const gm = S.moran(grad, W(g), { perms: 999, seed: 1 });
  assert(gm.I > 0.8 && gm.p_sim === 1 / 1000 && gm.p_rand < 1e-10, 'gradient clusters');
});

/* ---- local Moran */
t('local moran', () => {
  const g = grid(8, 8, false); const Wg = W(g); const r = S.rng(3); const v = Array.from({ length: 64 }, (_, k) => (k % 8 < 3 && k < 24 ? 10 : 0) + r() * 3);
  const L = S.localMoran(v, Wg, { perms: 499, seed: 11 }); const G = S.moran(v, Wg, { perms: 0 });
  near(L.Is.reduce((a, b) => a + b, 0), (64 - 1) * G.I, 1e-9, 'Σ I_i = (n − 1) I with row standardized weights');
  eq(L.q[0], 'HH', 'a corner inside the high block is high among high'); eq(L.cls[0], 'HH', 'and significant');
  eq(L.counts.HH + L.counts.LL + L.counts.HL + L.counts.LH + L.counts.ns, 64, 'counts cover every area');
  assert(L.p.every(p => p >= 1 / 500 && p <= 0.5 + 1e-12), 'folded pseudo p between 1/(perms + 1) and one half');
  eq(S.localMoran(v, Wg, { perms: 499, seed: 11 }).p, L.p, 'reproducible');
});

/* ---- weights */
t('weights', () => {
  const k = S.knn([[0, 0], [1, 0], [3, 0], [6, 0]], 1); eq(k.nb, [[1], [0], [1], [2]], 'one nearest neighbor on a line'); eq(k.w[0], [1], 'row standardized');
  const k2 = S.knn([[0, 0], [1, 0], [3, 0], [6, 0]], 2); eq(k2.nb[3], [2, 1], 'two nearest, nearest first');
  // four unit squares: every pair touches at least at a corner (queen); a square two units away touches none
  const sq = (x, y) => `M${x},${y} ${x + 1},${y} ${x + 1},${y + 1} ${x},${y + 1}Z`;
  const c = S.contiguity([sq(0, 0), sq(1, 0), sq(0, 1), sq(1, 1), sq(4, 4)], 0.05);
  eq(c.nb, [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2], []], 'queen contiguity from outlines');
  // borders a simplifier pulled 0.3 apart still meet at tolerance 0.5 and not at 0.1
  const gapA = 'M0,0 1,0 1,1 0,1Z', gapB = 'M1.3,0 2.3,0 2.3,1 1.3,1Z'; eq(S.contiguity([gapA, gapB], 0.5).nb, [[1], [0]], 'tolerance joins'); eq(S.contiguity([gapA, gapB], 0.1).nb, [[], []], 'tolerance separates');
  // a subset drops neighbors without data and the islands they leave
  const sub = S.subsetW(W([[1], [0, 2], [1, 3], [2], []]), [true, false, true, true, true]);
  eq(sub.idx, [2, 3], 'kept areas'); eq(sub.islands.sort(), [0, 4], 'islands listed'); eq(sub.nb, [[1], [0]], 'renumbered neighbors'); eq(sub.w, [[1], [1]], 'restandardized');
  eq(S.lag(W(path4), [1, 2, 3, 4]), [2, 2, 3, 3], 'spatial lag');
});

/* ---- survival and medians */
t('survival', () => {
  const s = S.survival([100, 200], [0, 0]); near(s[1].s, 0.9, 1e-12, 'S(1)'); near(s[2].s, 0.72, 1e-12, 'S(2)'); eq(s[2].lo, s[2].s, 'no error, no band');
  const b = S.survival([100, 200], [10, 10]); assert(b[2].lo < 0.72 && b[2].hi > 0.72, 'band brackets'); near(Math.log(b[2].s / b[2].lo) / 1.959964, Math.sqrt((0.01 / 0.9) ** 2 + (0.01 / 0.8) ** 2), 1e-12, 'Greenwood delta method');
  near(S.medianSurvival(S.survival([300, 300, 300])), 1 + (0.7 - 0.5) / (0.7 - 0.49), 1e-12, 'median survival interpolated between years 1 and 2');
  eq(S.medianSurvival(S.survival([10, 10])), null, 'median not reached');
  near(S.medianBands([{ lo: 0, hi: 10, w: 3 }, { lo: 10, hi: 20, w: 1 }]), 20 / 3, 1e-12, 'banded median');
  near(S.medianBands([{ lo: 0, hi: 10, w: 1 }, { lo: 10, hi: 20, w: 1 }]), 10, 1e-12, 'banded median at a boundary');
  eq(S.medianBands([{ lo: 0, hi: 10, w: 1 }, { lo: 10, hi: null, w: 5 }]), null, 'median in an open band');
});

/* ---- the async local Moran gives the same answer as the single pass and reports progress */
const g = grid(6, 6, false); const Wg = W(g); const v = Array.from({ length: 36 }, (_, k) => (k * 7919) % 13);
const sync = S.localMoran(v, Wg, { perms: 199, seed: 4 }); const ticks = [];
const asyncR = await S.localMoranAsync(v, Wg, { perms: 199, seed: 4, chunk: 5 }, (d, nn) => ticks.push(d + '/' + nn));
eq(asyncR.p, sync.p, 'chunked equals single pass'); eq(ticks[ticks.length - 1], '36/36', 'progress to the end'); assert(ticks.length === 8, 'eight chunks of five'); n++;
console.log(`stats: ${n} groups passed`);
