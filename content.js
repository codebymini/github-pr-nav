// GitHub PR Commit Prev/Next — content script.
//
// Adds a floating "‹ Prev · 3 / 8 · Next ›" control to the top of pull
// request pages that steps through the PR's commits one at a time
// (oldest first, same order as the PR's Commits tab).
//
// On a single-commit page (/pull/N/commits/<sha>) it shows which commit you're
// on. Anywhere else in the PR it shows "– / 8": Next opens the first commit and
// Prev opens the latest one.
(() => {
  'use strict';
  if (window.__prnavLoaded) return;
  window.__prnavLoaded = true;

  const ROOT_ID = 'prnav-root';
  const CACHE_PREFIX = 'prnav:commits:'; // sessionStorage, per PR
  const FRESH_MS = 60 * 1000; // re-check the commit list after this long
  const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/;
  const COMMIT_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(commits|changes|files)\/([0-9a-f]{7,40})\/?$/i;
  const FULL_SHA = /^[0-9a-f]{40}$/i;
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const KEY_HINT = { prev: IS_MAC ? '⌥⇧←' : 'Alt+Shift+←', next: IS_MAC ? '⌥⇧→' : 'Alt+Shift+→' };

  const cleanText = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const shortSha = (sha) => sha.slice(0, 7);

  function parseLocation() {
    const m = location.pathname.match(PR_PATH);
    if (!m) return null;
    const c = location.pathname.match(COMMIT_PATH);
    return {
      base: `/${m[1]}/${m[2]}/pull/${m[3]}`,
      key: `${m[1]}/${m[2]}#${m[3]}`.toLowerCase(),
      // Keep whichever single-commit URL style GitHub is using.
      segment: c ? c[1].toLowerCase() : 'commits',
      sha: c ? c[2].toLowerCase() : '',
    };
  }

  const indexOfSha = (commits, sha) => commits.findIndex((c) => c.sha.startsWith(sha));

  // ------------------------------------------------------- commit list

  // GitHub's React pages ship their data as JSON in <script> tags. On the
  // Commits tab the commits sit in arrays named "commits" (one per date group),
  // oldest first.
  function commitsFromJson(doc) {
    const out = [];
    const seen = new Set();
    const visit = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 40) return;
      if (Array.isArray(o)) {
        for (const v of o) visit(v, depth + 1);
        return;
      }
      for (const [k, v] of Object.entries(o)) {
        if (k === 'commits' && Array.isArray(v)) {
          for (const c of v) {
            if (!c || typeof c.oid !== 'string' || !FULL_SHA.test(c.oid)) continue;
            const sha = c.oid.toLowerCase();
            if (seen.has(sha)) continue;
            seen.add(sha);
            out.push({ sha, title: cleanText(c.shortMessage || c.messageHeadline || c.message || '') });
          }
        } else {
          visit(v, depth + 1);
        }
      }
    };
    for (const s of doc.querySelectorAll('script[type="application/json"][data-target="react-app.embeddedData"]')) {
      try {
        visit(JSON.parse(s.textContent), 0);
      } catch {
        /* not JSON */
      }
    }
    return out;
  }

  // Fallback: commit links in page order.
  function commitsFromDom(doc, base) {
    const prefix = `${base}/commits/`.toLowerCase();
    const bySha = new Map();
    for (const a of doc.querySelectorAll('a[href]')) {
      let path;
      try {
        path = new URL(a.getAttribute('href'), location.origin).pathname.toLowerCase();
      } catch {
        continue;
      }
      if (!path.startsWith(prefix)) continue;
      const sha = path.slice(prefix.length).replace(/\/$/, '');
      if (!FULL_SHA.test(sha)) continue;
      const text = cleanText(a.textContent);
      const title = /^[0-9a-f]{7,40}$/i.test(text) ? '' : text;
      const existing = bySha.get(sha);
      if (!existing) bySha.set(sha, { sha, title });
      else if (!existing.title && title) existing.title = title;
    }
    return [...bySha.values()];
  }

  const memoryCache = new Map();

  function readCache(key) {
    if (memoryCache.has(key)) return memoryCache.get(key);
    try {
      const entry = JSON.parse(sessionStorage.getItem(CACHE_PREFIX + key) || 'null');
      if (entry && Array.isArray(entry.commits)) {
        memoryCache.set(key, entry);
        return entry;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function writeCache(key, entry) {
    memoryCache.set(key, entry);
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      /* storage full: memory cache still works */
    }
  }

  const inFlight = new Map();
  function fetchCommits(pr) {
    if (!inFlight.has(pr.key)) {
      const job = (async () => {
        try {
          const res = await fetch(`${pr.base}/commits`, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
          if (!res.ok) return null;
          const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
          let commits = commitsFromJson(doc);
          if (!commits.length) commits = commitsFromDom(doc, pr.base);
          if (!commits.length) return null;
          const entry = { commits, ts: Date.now() };
          writeCache(pr.key, entry);
          return entry;
        } catch {
          return null;
        }
      })().finally(() => inFlight.delete(pr.key));
      inFlight.set(pr.key, job);
    }
    return inFlight.get(pr.key);
  }

  // ---------------------------------------------------------------- widget

  let current = null; // what the widget shows: { pr, commits?, status? }
  let wantedKey = '';
  let renderToken = 0;

  async function showFor(pr) {
    const token = ++renderToken;
    const cached = readCache(pr.key);
    render(cached ? { pr, commits: cached.commits } : { pr, status: 'loading' });

    const stale =
      !cached || Date.now() - cached.ts > FRESH_MS || (pr.sha && indexOfSha(cached.commits, pr.sha) < 0);
    if (!stale) return;
    const fresh = await fetchCommits(pr);
    if (token !== renderToken) return;
    if (fresh) render({ pr, commits: fresh.commits });
    else if (!cached) render({ pr, status: 'error' });
  }

  function chevron(dir) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', dir === 'prev' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5');
    svg.append(path);
    return svg;
  }

  function navButton(dir, commit, pr, disabledTip, verb) {
    const el = document.createElement(commit ? 'a' : 'span');
    el.className = `prnav-btn prnav-${dir}`;
    const label = document.createElement('span');
    label.textContent = dir === 'prev' ? 'Prev' : 'Next';
    if (dir === 'prev') el.append(chevron(dir), label);
    else el.append(label, chevron(dir));
    if (commit) {
      el.href = `${pr.base}/${pr.segment}/${commit.sha}`;
      el.dataset.prnav = dir;
      const what = verb || (dir === 'prev' ? 'Previous commit' : 'Next commit');
      el.title = `${what}: ${shortSha(commit.sha)} ${commit.title}`.trim() + `  (${KEY_HINT[dir]})`;
    } else {
      el.setAttribute('aria-disabled', 'true');
      el.title = disabledTip;
    }
    return el;
  }

  function positionLabel(text, href, tip) {
    const el = document.createElement(href ? 'a' : 'span');
    el.className = 'prnav-pos';
    el.textContent = text;
    el.title = tip;
    if (href) el.href = href;
    return el;
  }

  function buildControls({ pr, commits, status }) {
    if (!commits) {
      const tip = status === 'loading' ? 'Loading commits…' : 'Couldn’t load this pull request’s commits.';
      return [
        navButton('prev', null, pr, tip),
        positionLabel(status === 'loading' ? '…' : '–', null, tip),
        navButton('next', null, pr, tip),
      ];
    }
    const n = commits.length;
    const listHref = `${pr.base}/commits`;
    const idx = pr.sha ? indexOfSha(commits, pr.sha) : -1;
    if (idx < 0) {
      // Not on a single commit (Conversation, Files changed, …): jump in.
      return [
        navButton('prev', commits[n - 1], pr, '', 'Latest commit'),
        positionLabel(`– / ${n}`, listHref, `${n} commit${n === 1 ? '' : 's'} in this pull request`),
        navButton('next', commits[0], pr, '', 'First commit'),
      ];
    }
    return [
      navButton('prev', commits[idx - 1], pr, 'This is the first commit'),
      positionLabel(`${idx + 1} / ${n}`, listHref, 'All commits'),
      navButton('next', commits[idx + 1], pr, 'This is the last commit'),
    ];
  }

  function render(view) {
    current = view;
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('nav');
      root.id = ROOT_ID;
      root.setAttribute('aria-label', 'Commit navigation');
    }
    root.replaceChildren(...buildControls(view));
    if (!root.isConnected) document.body.append(root);
  }

  function removeWidget() {
    renderToken++;
    current = null;
    wantedKey = '';
    document.getElementById(ROOT_ID)?.remove();
  }

  // ---------------------------------------------------------------- wiring

  function tick() {
    const pr = parseLocation();
    if (!pr) {
      if (wantedKey || current) removeWidget();
      return;
    }
    const key = `${pr.key}|${pr.segment}|${pr.sha}`;
    if (key !== wantedKey) {
      wantedKey = key;
      showFor(pr);
    } else if (current && !document.getElementById(ROOT_ID)) {
      render(current); // GitHub re-rendered the page and dropped us
    }
  }

  let timer = 0;
  function schedule() {
    if (!timer) {
      timer = setTimeout(() => {
        timer = 0;
        tick();
      }, 150);
    }
  }

  // GitHub navigates without full page loads (Turbo + React), so watch the DOM.
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('turbo:load', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('pageshow', schedule);

  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target;
      if (t instanceof Element && (t.closest('input, textarea, select') || t.isContentEditable)) return;
      const dir = e.key === 'ArrowLeft' ? 'prev' : 'next';
      const link = document.querySelector(`#${ROOT_ID} a[data-prnav="${dir}"]`);
      if (link) {
        e.preventDefault();
        link.click();
      }
    },
    true
  );

  tick();
})();
