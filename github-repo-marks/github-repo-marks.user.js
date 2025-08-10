// ==UserScript==
// @name         GitHub Repo Marks (Excluded)
// @namespace    https://jovylle.com
// @version      1.3.5
// @description  Mark repos as Excluded. Hide Excluded.
// @author       Jow
// @match        https://github.com/*?tab=repositories*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @downloadURL  https://raw.githubusercontent.com/jovylle/userscripts-tampermonkey/master/github-repo-marks/github-repo-marks.user.js
// @updateURL    https://raw.githubusercontent.com/jovylle/userscripts-tampermonkey/master/github-repo-marks/github-repo-marks.user.js
// ==/UserScript==
(function () {
  const STORE_KEY = "jow:repoMarks:v1";
  const UI_FLAG = "data-jow-mounted";
  const STATE = loadState();
  let hideExcluded = GM_getValue("jow:hideExcluded", false);

  GM_addStyle(`
    .jow-excluded {
      display: none !important; /* This will ensure it is hidden */
      opacity: 60%; /* Optional: make it semi-transparent */
    }
    
    .jow-visible {
      display: flex !important; /* Or your desired display type */
    }
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
    const cards = document.querySelectorAll('#user-repositories-list>ul>li:not([' + UI_FLAG + '])');
    cards.forEach((li) => mountCard(li));
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
    excludeCheckbox.checked = st.excluded || false; // Initialize checked state

    excludeCheckbox.addEventListener('change', () => {
      st.excluded = excludeCheckbox.checked;
      STATE[repoPath] = st;
      saveState();
      applyStateToCard(li, st); // Ensure the class is updated
      applyHideExcluded(); // Hide excluded immediately after state change
    });

    li.appendChild(menu);
  }

  function maybeAddTopbar () {
    if (document.querySelector('.jow-topbar')) return;
    const container = document.querySelector('div#user-repositories-list');
    const top = document.createElement('div');
    top.className = 'jow-topbar';
    top.innerHTML = `
      <label class="jow-mini"><input type="checkbox" class="jow-show"> Show Excluded 1</label>
    `;
    const showExcluded = top.querySelector('.jow-show');
    showExcluded.checked = false; // Default state is hidden
    showExcluded.addEventListener('change', () => {
      hideExcluded = !showExcluded.checked; // Toggle hideExcluded based on checkbox
      GM_setValue("jow:hideExcluded", hideExcluded);
      applyHideExcluded();
    });

    container.prepend(top);
  }

  function applyStateToCard (li, st) {
    li.classList.toggle('jow-excluded', st.excluded); // Only handle excluded state
  }

  function applyHideExcluded () {
    document.querySelectorAll('#user-repositories-list>ul>li[' + UI_FLAG + ']').forEach(li => {
      const excluded = li.classList.contains('jow-excluded');
      // li.style.display = (hideExcluded && excluded) ? 'none' : 'flex !important'; // Use display: none; for hiding
      li.classList.toggle('jow-visible', !hideExcluded || !excluded);
    });
  }

  function ensureDefaults (s) {
    if (!('excluded' in s)) s.excluded = false; // Default to not excluded
    return s;
  }

  function loadState () {
    try { return JSON.parse(GM_getValue(STORE_KEY, "{}")); } catch { return {}; }
  }
  function saveState () {
    GM_setValue(STORE_KEY, JSON.stringify(STATE));
  }

  function hookRouting () {
    window.addEventListener('turbo:load', run, { passive: true });
    document.addEventListener('pjax:end', run, { passive: true });
    window.addEventListener('popstate', run, { passive: true });
    setInterval(run, 1500);
  }

  function debounce (fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function notify (msg) { console.log('[Repo Marks]', msg); }
})();