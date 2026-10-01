/* SEVERANCE workspace: one backup of everything saved in this browser (the firm profile, plans, ledgers, watch, actuals, module state)
   and its restore. The Thermal Atlas saves module by module; this goes further because the hosted viewer and the extension keep their
   storage apart, and a firm moving between them wants one file. Credentials (CMS passwords and keys, ad account tokens) stay out of the
   backup unless the user ticks the box. */
'use strict';
const WORKSPACE = (() => {
  const EXT_KEYS = ['sv.cms.v1', 'sv.accounts.v1'];   // the CMS and accounts layers keep these in chrome.storage.local in the extension
  const SECRET = /(token|secret|password|pass|apikey|api_key|key|refresh|access|client_secret|auth)$/i;
  const scrub = (v, keep) => { if (keep || v == null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(x => scrub(x, false)); const o = {}; for (const k in v) o[k] = SECRET.test(k) && typeof v[k] === 'string' && v[k] ? '' : scrub(v[k], false); return o; };
  async function extGet(k) { if (!RT || !RT.storage) return undefined; try { const r = await RT.storage.local.get(k); return r[k]; } catch (e) { return undefined; } }
  async function extSet(k, v) { if (!RT || !RT.storage) return false; try { await RT.storage.local.set({ [k]: v }); return true; } catch (e) { return false; } }
  async function collect(withSecrets) {
    const local = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!/^sv\./.test(k)) continue; let v = localStorage.getItem(k); try { v = JSON.parse(v); } catch (e) { } local[k] = EXT_KEYS.includes(k) ? scrub(v, withSecrets) : v; } } catch (e) { }
    const ext = {}; for (const k of EXT_KEYS) { const v = await extGet(k); if (v !== undefined) ext[k] = scrub(v, withSecrets); }
    return { severance_workspace: 2, saved: new Date().toISOString(), env: ENV, firm: FIRM.name() || '', credentials: !!withSecrets, local, ext };
  }
  async function restore(w) {
    if (!w || w.severance_workspace == null || typeof w.local !== 'object') throw new Error('This file is not a Severance workspace backup.');
    let n = 0; for (const k in w.local) { if (!/^sv\./.test(k)) continue; try { localStorage.setItem(k, typeof w.local[k] === 'string' ? w.local[k] : JSON.stringify(w.local[k])); n++; } catch (e) { throw new Error('This browser refused to store ' + k + ' (storage full?).'); } }
    for (const k in (w.ext || {})) { if (!EXT_KEYS.includes(k)) continue; if (!(await extSet(k, w.ext[k]))) { try { localStorage.setItem(k, JSON.stringify(w.ext[k])); n++; } catch (e) { } } else n++; }
    return n;
  }
  const size = o => { const b = new Blob([JSON.stringify(o)]).size; return b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; };
  function panel() {
    openModal(`<h3 style="font-family:var(--display);font-size:22px">Workspace backup</h3>
      <p class="small">One JSON file with everything Severance saved in this browser: the firm profile, Campaign Desk plans, Site Forge plans, compliance texts and the filing log, the competitor watch, the actuals imported in Accounts, the Live Desk settings and the map views. Restoring replaces those entries here and reloads the page.</p>
      <div class="btnrow"><label class="chk"><input type="checkbox" id="wsSecrets"> Include saved credentials (CMS passwords and API keys, ad account tokens). Keep a file with credentials somewhere safe.</label></div>
      <div class="btnrow"><button type="button" class="btn primary" id="wsSave">↓ Back up everything</button><button type="button" class="btn" id="wsLoad">↑ Restore from a backup</button><button type="button" class="btn" id="wsClose">Close</button></div>
      <div class="small" id="wsMsg" role="status"></div>`);
    $('#wsSave').onclick = async () => { const w = await collect($('#wsSecrets').checked); const name = `severance_workspace_${slug(FIRM.name() || 'firm')}_${todayISO().replace(/-/g, '')}.json`; saveFile(name, JSON.stringify(w, null, 1)); $('#wsMsg').textContent = `${Object.keys(w.local).length + Object.keys(w.ext).length} entries, ${size(w)}${w.credentials ? ', credentials included' : ', credentials left out'}.`; };
    $('#wsLoad').onclick = async () => {
      const [f] = await pickFiles('.json,application/json'); if (!f) return;
      let w; try { w = JSON.parse(await readText(f)); } catch (e) { $('#wsMsg').textContent = 'That file is not JSON.'; return; }
      if (!w || w.severance_workspace == null) { $('#wsMsg').textContent = 'That file is not a Severance workspace backup.'; return; }
      const keys = Object.keys(w.local || {}).concat(Object.keys(w.ext || {}));
      $('#wsMsg').innerHTML = `${esc(f.name)}: ${keys.length} entries saved ${esc(fmtDate(String(w.saved || '').slice(0, 10)))}${w.firm ? ' for ' + esc(w.firm) : ''}${w.credentials ? ', with credentials' : ''}. <button type="button" class="btn sm primary" id="wsGo">Replace and reload</button>`;
      $('#wsGo').onclick = async () => { try { const n = await restore(w); $('#wsMsg').textContent = `Restored ${n} entries. Reloading.`; setTimeout(() => location.reload(), 600); } catch (e) { $('#wsMsg').textContent = e.message; } };
    };
    $('#wsClose').onclick = closeModal;
  }
  return { collect, restore, panel };
})();
