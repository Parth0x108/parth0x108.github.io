(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const root = document.documentElement;
  const routes = new Set(['/', '/work/', '/writing/', '/bounties/']);
  const build = $('meta[name="portfolio-build"]')?.content;
  const cache = new Map();
  const pending = new Map();
  const positions = new Map();
  let currentURL = new URL(location.href);
  let currentKey = history.state?.portfolioKey || crypto.randomUUID();
  let navigation = 0;
  let loadingTimer;

  function syncTheme() {
    const light = root.dataset.theme === 'light';
    $$('[data-theme-toggle]').forEach(button => {
      button.textContent = light ? '☾  Dark' : '☀  Light';
      button.setAttribute('aria-label', light ? 'Use dark theme' : 'Use light theme');
      button.title = button.getAttribute('aria-label');
    });
    const themeColor = $('meta[name="theme-color"]');
    if (themeColor) themeColor.content = light ? '#f6f7f8' : '#212121';
  }
  $$('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('parth-theme', root.dataset.theme); } catch { /* Storage can be disabled. */ }
    syncTheme();
  }));
  syncTheme();

  const menu = $('.menu-toggle');
  const drawer = $('.mobile-drawer');
  function closeMenu(restoreFocus = true) {
    const open = menu?.getAttribute('aria-expanded') === 'true';
    menu?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-label', 'Open menu');
    drawer?.classList.remove('open');
    document.body.classList.remove('nav-open');
    if (open && restoreFocus) menu.focus();
  }
  menu?.addEventListener('click', () => {
    if (menu.getAttribute('aria-expanded') === 'true') { closeMenu(); return; }
    menu.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', 'Close menu');
    drawer.classList.add('open');
    document.body.classList.add('nav-open');
  });
  matchMedia('(min-width:981px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });
  drawer?.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu(false);
  });
  addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
    if (event.key !== 'Tab' || menu?.getAttribute('aria-expanded') !== 'true') return;
    const controls = [menu, ...$$('a,button,summary', drawer).filter(item => item.getClientRects().length)];
    const index = controls.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); menu.focus(); }
  });

  function initializeContent() {
    const main = $('#content');
    const specializations = $$('.specializations details', main);
    specializations.forEach(item => item.addEventListener('toggle', () => {
      if (item.open && item.isConnected) specializations.forEach(other => {
        if (other !== item) other.open = false;
      });
    }));
    $$('[data-year]', main).forEach(element => { element.textContent = String(new Date().getFullYear()); });
  }
  initializeContent();

  // Static HTML remains the source of truth. The cache lasts only for this browser document.
  const metadata = ['meta[name="description"]', 'meta[property="og:title"]',
    'meta[property="og:description"]', 'meta[property="og:url"]', 'link[rel="canonical"]'];
  function snapshot(doc) {
    return { main: $('#content', doc).outerHTML, title: doc.title,
      head: metadata.map(selector => ({ selector, html: $(selector, doc)?.outerHTML })) };
  }
  cache.set(currentURL.pathname, snapshot(document));
  function getPage(path) {
    if (cache.has(path)) return Promise.resolve(cache.get(path));
    if (pending.has(path)) return pending.get(path);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const request = fetch(`${path}?nav=${encodeURIComponent(build)}`, {
      signal: controller.signal, credentials: 'same-origin', headers: { Accept: 'text/html' }
    }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Page unavailable');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!$('#content', doc) || $('meta[name="portfolio-build"]', doc)?.content !== build) throw new Error('New build');
      const page = snapshot(doc);
      cache.set(path, page);
      return page;
    }).finally(() => { clearTimeout(timeout); pending.delete(path); });
    pending.set(path, request);
    return request;
  }
  const status = document.createElement('div');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  document.body.append(status);
  history.replaceState({ ...history.state, portfolioKey: currentKey }, '', currentURL);
  history.scrollRestoration = 'manual';

  function setCurrentRoute(path) {
    $$('.side-nav a').forEach(link => {
      if (link.origin === location.origin && link.pathname === path) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $$('.nav-disclosure').forEach(item => {
      if ($('a[aria-current="page"]', item)) item.open = true;
    });
  }
  function scrollToDestination(url, position) {
    if (position) { window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' }); return; }
    if (url.hash) {
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { id = url.hash.slice(1); }
      const target = document.getElementById(id);
      if (target) { target.scrollIntoView({ behavior: 'instant', block: 'start' }); return; }
    }
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  }
  async function navigate(url, fromHistory = false) {
    const id = ++navigation;
    const started = performance.now();
    clearTimeout(loadingTimer);
    root.classList.remove('route-loading');
    positions.set(currentKey, { x: scrollX, y: scrollY });
    cache.set(currentURL.pathname, snapshot(document));
    closeMenu(false);
    loadingTimer = setTimeout(() => {
      root.classList.add('route-loading'); status.textContent = 'Loading page';
    }, 160);
    try {
      const page = await getPage(url.pathname);
      if (id !== navigation) return;
      if (!fromHistory && url.href !== currentURL.href) {
        currentKey = crypto.randomUUID();
        history.pushState({ portfolioKey: currentKey }, '', url);
      } else if (fromHistory) currentKey = history.state?.portfolioKey || crypto.randomUUID();
      const samePage = currentURL.pathname === url.pathname;
      if (!samePage) {
        const template = document.createElement('template');
        template.innerHTML = page.main;
        $('#content').replaceWith(template.content.firstElementChild);
        document.title = page.title;
        page.head.forEach(({ selector, html }) => {
          if (!html) return;
          const fragment = document.createElement('template'); fragment.innerHTML = html;
          $(selector)?.replaceWith(fragment.content.firstElementChild);
        });
        initializeContent();
      }
      currentURL = url;
      setCurrentRoute(url.pathname);
      scrollToDestination(url, fromHistory ? positions.get(currentKey) : null);
      const heading = url.hash ? document.getElementById(url.hash.slice(1)) : $('h1', $('#content'));
      if (heading && !fromHistory) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      $('#content').dataset.navigationMs = (performance.now() - started).toFixed(1);
      status.textContent = document.title;
    } catch {
      if (id === navigation) location.assign(url.href);
    } finally {
      if (id === navigation) { clearTimeout(loadingTimer); root.classList.remove('route-loading'); }
    }
  }
  function internalURL(link) {
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return null;
    const url = new URL(link.href, location.href);
    return url.origin === location.origin && routes.has(url.pathname) ? url : null;
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = internalURL(event.target.closest('a[href]'));
    if (!url) return;
    event.preventDefault();
    navigate(url);
  });
  addEventListener('popstate', () => {
    const url = new URL(location.href);
    if (routes.has(url.pathname)) navigate(url, true);
    else location.reload();
  });
  addEventListener('pagehide', () => { positions.set(currentKey, { x: scrollX, y: scrollY }); });
  addEventListener('pageshow', event => {
    if (event.persisted) { navigation++; clearTimeout(loadingTimer); root.classList.remove('route-loading'); }
  });

  const warm = path => { getPage(path).catch(() => { /* Native navigation remains available. */ }); };
  ['pointerover', 'focusin', 'pointerdown'].forEach(type => document.addEventListener(type, event => {
    const url = internalURL(event.target.closest('a[href]'));
    if (url) warm(url.pathname);
  }, { passive: true }));
  const connection = navigator.connection;
  if (!connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType)) {
    const warmAll = () => {
      const remaining = [...routes].filter(path => path !== currentURL.pathname);
      const worker = async () => {
        while (remaining.length) {
          const path = remaining.shift();
          try { await getPage(path); } catch { /* Retry on explicit intent. */ }
        }
      };
      worker(); worker();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(warmAll, { timeout: 350 });
    else setTimeout(warmAll, 250);
  }
})();
