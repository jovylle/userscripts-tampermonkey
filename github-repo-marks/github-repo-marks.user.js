// ==UserScript==
// @name         GitHub Repo Favorites/Focus
// @namespace    https://jovylle.com
// @version      1.3.6
// @description  Mark repos as Excluded. Hide Excluded. Uses localStorage instead of GM_* APIs.
// @author       Jow
// @match        https://github.com/*tab=repositories*
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/jovylle/userscripts-tampermonkey/main/github-repo-marks/github-repo-marks.user.js
// @updateURL    https://raw.githubusercontent.com/jovylle/userscripts-tampermonkey/main/github-repo-marks/github-repo-marks.user.js
// ==/UserScript==
(() => {
  const STORE_KEY = "jow:repoMarks:v1";
  const HIDE_KEY  = "jow:hideExcluded";
  const UI_FLAG   = "data-jow-mounted";

  const STATE = loadState();
  let hideExcluded = getVal(HIDE_KEY, "false") === "true";

  addStyle(`
    .jow-excluded { display:none !important; opacity:60%; }
    .jow-show-excluded { display:flex !important; }
    .jow-float {
      position:absolute; top:8px; right:8px; z-index:5; display:flex; gap:8px; align-items:center;
      padding:4px 8px; border:1px solid var(--color-border-default,#d0d7de); border-radius:8px;
      background:var(--color-canvas-default,#fff); box-shadow:0 2px 8px rgba(0,0,0,.06);
      opacity:0; pointer-events:none; transition:opacity .12s ease, transform .12s ease; transform:translateY(-2px);
    }
    #user-repositories-list>ul>li:hover .jow-float { opacity:1; pointer-events:auto; transform:translateY(0); }
    .jow-mini{font-size:12px;display:inline-flex;align-items:center;gap:4px;cursor:pointer}
    .jow-status{font-size:12px;padding:2px 4px}
    .jow-topbar{
      display:flex; gap:8px; align-items:center; padding:8px; margin:8px 0;
      border:1px solid var(--color-border-default,#d0d7de); border-radius:8px; background:var(--color-canvas-default,#fff);
    }
    .jow-btn{font-size:12px;padding:4px 8px;border:1px solid var(--color-border-default,#d0d7de);border-radius:6px;background:var(--color-canvas-subtle,#f6f8fa);cursor:pointer}
    .jow-badge{font-size:12px;opacity:.8}
  `);

  hookRouting();
  run();
  const mo = new MutationObserver(debounce(run, 150));
  mo.observe(document.documentElement, { subtree: true, childList: true });

  function run () {
    maybeAddTopbar();
    document.querySelectorAll('#user-repositories-list>ul>li:not([' + UI_FLAG + '])')
      .forEach(mountCard);
    applyHideExcluded();
  }

  function mountCard (li) {
    const main = li.querySelector('.col-10.col-lg-9.d-inline-block, .col-10.col-lg-9');
    const a = li.querySelector('a[itemprop="name codeRepository"], a.Link--primary, a[href^="/"][data-hovercard-type="repository"]');
    if (!main || !a) return;

    const repoPath = a.getAttribute('href').replace(/^\/+/, ""); // owner/repo
    const st = ensureDefaults(STATE[repoPath] || {});
    STATE[repoPath] = st; saveState();

    li.setAttribute(UI_FLAG, '1');
    if (!li.style.position) li.style.position = 'relative';
    applyStateToCard(li, st);

    const menu = document.createElement('div');
    menu.className = 'jow-float';
    menu.innerHTML = `
      <label class="jow-mini">
        <input type="checkbox" class="jow-exclude"> Exclude
      </label>
      <span class="jow-badge">${repoPath}</span>
    `;
    const excludeCheckbox = menu.querySelector('.jow-exclude');
    excludeCheckbox.checked = !!st.excluded;

    excludeCheckbox.addEventListener('change', () => {
      st.excluded = excludeCheckbox.checked;
      STATE[repoPath] = st;
      saveState();
      applyStateToCard(li, st);
      applyHideExcluded();
    });

    li.appendChild(menu);
  }

  function maybeAddTopbar () {
    if (document.querySelector('.jow-topbar')) return;
    const container = document.querySelector('div#user-repositories-list');
    if (!container) return;

    const top = document.createElement('div');
    top.className = 'jow-topbar';
    top.innerHTML = `
      <label class="jow-mini"><input type="checkbox" class="jow-show"> Show Excluded</label>
    `;
    const showExcluded = top.querySelector('.jow-show');
    showExcluded.checked = !hideExcluded;
    showExcluded.addEventListener('change', () => {
      hideExcluded = !showExcluded.checked;
      setVal(HIDE_KEY, String(hideExcluded));
      applyHideExcluded();
    });

    container.prepend(top);
  }

  function applyStateToCard (li, st) {
    li.classList.toggle('jow-excluded', !!st.excluded);
  }

  function applyHideExcluded () {
    document.querySelectorAll('#user-repositories-list>ul>li[' + UI_FLAG + ']').forEach(li => {
      const excluded = li.classList.contains('jow-excluded');
      li.classList.toggle('jow-show-excluded', !hideExcluded || !excluded);
    });
  }

  function ensureDefaults (s) {
    if (!('excluded' in s)) s.excluded = false;
    return s;
  }

  // ---- storage + utils (no GM_*) ----
  function loadState () {
    try { return JSON.parse(getVal(STORE_KEY, "{}")); } catch { return {}; }
  }
  function saveState () {
    setVal(STORE_KEY, JSON.stringify(STATE));
  }
  function getVal (k, defVal) {
    const v = localStorage.getItem(k);
    return v === null ? defVal : v;
    }
  function setVal (k, v) { localStorage.setItem(k, v); }
  function addStyle (css) {
    const s = document.createElement('style');
    s.textContent = css;
    document.documentElement.appendChild(s);
  }

  function hookRouting () {
    window.addEventListener('turbo:load', run, { passive: true });
    document.addEventListener('pjax:end', run, { passive: true });
    window.addEventListener('popstate', run, { passive: true });
    setInterval(run, 1500);
  }

  function debounce (fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
})();
