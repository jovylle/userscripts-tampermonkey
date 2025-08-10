// ==UserScript==
// @name         GitHub Repo Marks (Fav/Active/Excluded) + Export/Import
// @namespace    https://jow.local
// @version      1.3.0
// @description  Mark repos as Active/Excluded (favorites kept internally). Hide Excluded + Export/Import.
// @author       Jow
// @match        https://github.com/*?tab=repositories*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @downloadURL  https://raw.githubusercontent.com/jovylle/userscripts-tampermonkey/main/github-repo-marks/github-repo-marks.user.js
// @updateURL    https://raw.githubusercontent.com/jovylle/userscripts-tampermonkey/main/github-repo-marks/github-repo-marks.user.js
// ==/UserScript==
(function () {
  const STORE_KEY = "jow:repoMarks:v1";
  const UI_FLAG = "data-jow-mounted";
  const STATE = loadState();
  let hideExcluded = GM_getValue("jow:hideExcluded", false);

  GM_addStyle(`
    .jow-excluded { opacity:.35; filter:grayscale(.5); transition:opacity .15s ease; }
    .jow-excluded:hover { opacity:.55; }
    /* Remove any visual for favorites (state still exists) */
    .jow-fav::before { content:none !important; }
    /* ACTIVE gets its own bar (independent of fav) */
    .jow-active::before {
      content:""; position:absolute; left:-2px; top:0; bottom:0; width:4px;
      border-radius:2px; background:#2da44e;
    }
    .jow-float {
      position:absolute; top:8px; right:8px; z-index:5; display:flex; gap:8px; align-items:center;
      padding:4px 8px; border:1px solid var(--color-border-default,#d0d7de); border-radius:8px;
      background:var(--color-canvas-default,#fff); box-shadow:0 2px 8px rgba(0,0,0,.06);
      opacity:0; pointer-events:none; transition:opacity .12s ease, transform .12s ease; transform:translateY(-2px);
    }
    #user-repositories-list ul li:hover .jow-float { opacity:1; pointer-events:auto; transform:translateY(0); }
    .jow-mini{font-size:12px;display:inline-flex;align-items:center;gap:4px;cursor:pointer}
    .jow-status{font-size:12px;padding:2px 4px}
    .jow-topbar{
      display:flex; gap:8px; align-items:center; padding:8px; margin:8px 0;
      border:1px solid var(--color-border-default,#d0d7de); border-radius:8px; background:var(--color-canvas-default,#fff);
    }
    .jow-btn{font-size:12px;padding:4px 8px;border:1px solid var(--color-border-default,#d0d7de);border-radius:6px;background:var(--color-canvas-subtle,#f6f8fa);cursor:pointer}
    .jow-badge{font-size:12px;opacity:.8}
    /* Hide the Unfavorite control (keep DOM for compatibility) */
    .jow-unfav,
    label:has(.jow-unfav),
    .jow-unfav + label { display:none !important; }
  `);

  hookRouting();
  run();
  const mo = new MutationObserver(debounce(run, 150));
  mo.observe(document.documentElement, { subtree: true, childList: true });

  function run() {
    maybeAddTopbar();
    const cards = document.querySelectorAll('#user-repositories-list ul li:not(['+UI_FLAG+'])');
    cards.forEach((li) => mountCard(li));
    applyHideExcluded();
  }

  function mountCard(li) {
    const main = li.querySelector('.col-10.col-lg-9.d-inline-block, .col-10.col-lg-9');
    const a = li.querySelector('a[itemprop="name codeRepository"], a.Link--primary, a[href^="/"][data-hovercard-type="repository"]');
    if (!main || !a) return;

    const repoPath = a.getAttribute('href').replace(/^\/+/, ""); // owner/repo
    const st = ensureDefaults(STATE[repoPath] || {});
    STATE[repoPath] = st; saveState();

    li.setAttribute(UI_FLAG,'1');
    if (!li.style.position) li.style.position = 'relative';
    applyStateToCard(li, st);

    const menu = document.createElement('div');
    menu.className = 'jow-float';
    menu.innerHTML = `
      <label class="jow-mini">
        <input type="checkbox" class="jow-unfav"> Unfavorite
      </label>
      <select class="jow-status" aria-label="Set repo status">
        <option value="">None</option>
        <option value="active">Active</option>
        <option value="excluded">Excluded</option>
      </select>
      <span class="jow-badge">${repoPath}</span>
    `;
    const unfav = menu.querySelector('.jow-unfav');
    const sel = menu.querySelector('.jow-status');
    if (unfav) unfav.checked = !st.fav;
    sel.value = st.status || "";

    if (unfav) {
      unfav.addEventListener('change', () => {
        st.fav = !unfav.checked;
        STATE[repoPath] = st; saveState(); applyStateToCard(li, st); applyHideExcluded();
      });
    }
    sel.addEventListener('change', () => {
      st.status = sel.value || "";
      STATE[repoPath] = st; saveState(); applyStateToCard(li, st); applyHideExcluded();
    });

    li.appendChild(menu);
  }

  function maybeAddTopbar() {
    if (document.querySelector('.jow-topbar')) return;
    const container = document.querySelector('div#user-repositories-list, div#org-repositories, div[data-test-selector="profile-tab-container"]') || document.body;
    const top = document.createElement('div');
    top.className = 'jow-topbar';
    top.innerHTML = `
      <label class="jow-mini"><input type="checkbox" class="jow-hide"> Hide Excluded</label>
      <button class="jow-btn jow-export">Export</button>
      <button class="jow-btn jow-import">Import</button>
      <span class="jow-badge">Repo Marks active</span>
    `;
    const hide = top.querySelector('.jow-hide');
    hide.checked = !!hideExcluded;
    hide.addEventListener('change', () => { hideExcluded = hide.checked; GM_setValue("jow:hideExcluded", hideExcluded); applyHideExcluded(); });

    top.querySelector('.jow-export').addEventListener('click', () => {
      const blob = JSON.stringify(STATE, null, 2);
      GM_setClipboard(blob, { type: 'text', mimetype: 'text/plain' });
      notify('Exported to clipboard.');
    });

    top.querySelector('.jow-import').addEventListener('click', () => {
      const json = prompt('Paste JSON to import (this will merge):');
      if (!json) return;
      try {
        const obj = JSON.parse(json);
        Object.assign(STATE, obj);
        saveState();
        document.querySelectorAll('#user-repositories-list ul li['+UI_FLAG+']').forEach(li => {
          const a = li.querySelector('a[itemprop="name codeRepository"], a.Link--primary, a[href^="/"][data-hovercard-type="repository"]');
          if (!a) return;
          const repoPath = a.getAttribute('href').replace(/^\/+/, "");
          const st = ensureDefaults(STATE[repoPath] || {});
          STATE[repoPath] = st; applyStateToCard(li, st);
        });
        applyHideExcluded();
        notify('Import complete.');
      } catch (e) { alert('Invalid JSON'); }
    });

    container.prepend(top);
  }

  function applyStateToCard(li, st) {
    li.classList.toggle('jow-fav', !!st.fav);
    li.classList.toggle('jow-active', st.status === 'active');
    li.classList.toggle('jow-excluded', st.status === 'excluded');
  }

  function applyHideExcluded() {
    document.querySelectorAll('#user-repositories-list ul li['+UI_FLAG+']').forEach(li => {
      const excluded = li.classList.contains('jow-excluded');
      li.style.display = (hideExcluded && excluded) ? 'none' : '';
    });
  }

  function ensureDefaults(s) {
    if (!('fav' in s)) s.fav = true;     // keep Favorite state, default ON
    if (!('status' in s)) s.status = ""; // default None
    return s;
  }

  function loadState() {
    try { return JSON.parse(GM_getValue(STORE_KEY, "{}")); } catch { return {}; }
  }
  function saveState() {
    GM_setValue(STORE_KEY, JSON.stringify(STATE));
  }

  function hookRouting() {
    window.addEventListener('turbo:load', run, { passive: true });
    document.addEventListener('pjax:end', run, { passive: true });
    window.addEventListener('popstate', run, { passive: true });
    setInterval(run, 1500);
  }

  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function notify(msg){ console.log('[Repo Marks]', msg); }
})();
