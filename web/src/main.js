// main.js — app entry point

import { fetchAuthUser } from './auth.js';
import { api } from './api.js';
import { getState, setState, subscribe } from './state.js';
import { escapeHtml } from './utils.js';
import { renderGroupsPage } from './pages/groups.js';
import { renderBracketPage, renderBracketContent } from './pages/bracket.js';
import { renderLeaderboardPage } from './pages/leaderboard.js';
import { renderLeaguesPage } from './pages/leagues.js';

const LOCK_DEADLINE_DEV = '2026-06-11T19:00:00Z'; // fallback

// ─── Slide Panel (Groups ↔ Bracket transition) ─────────────
const PEEK_WIDTH = 180;        // px of bracket visible while on groups page
const PEEK_LEFT = 120;         // px of groups visible when on bracket page
const PANEL_GAP = 24;          // px gap between groups and bracket panels
const GROUPS_MAX_W = 620;      // max width for groups panel (2-col cards)
let sliderActive = false;
let currentSlide = 'groups';
let unsubBracketSync = null;
let savedScrollY = { groups: 0, bracket: 0 };

// --- Dark Mode ---
function initTheme() {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);

  // Listen for system preference changes when no user override
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
  });

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      applyTheme(next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const icon = document.querySelector('#theme-toggle i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

async function init() {
  initTheme();
  // Load auth + teams in parallel
  const [authUser, teams] = await Promise.all([
    fetchAuthUser(),
    api.getTeams().catch(() => []),
  ]);

  // Determine if locked (client-side check; server enforces too)
  const deadline = new Date(LOCK_DEADLINE_DEV);
  const locked = new Date() >= deadline;

  setState({ user: authUser, teams, locked, lockDeadline: deadline });

  // Render auth header
  renderAuthHeader(authUser);

  // Load user picks if authenticated
  if (authUser) {
    try {
      const picks = await api.getPicks();
      setState({ picks, locked: locked || !!picks?.lockedAt });
    } catch { /* not logged in or no picks yet */ }
  }

  // Set up navigation
  setupNavigation();

  // Route to initial page
  const hash = location.hash.replace('#', '') || 'groups';
  navigateTo(hash);
}

function renderAuthHeader(user) {
  const el = document.getElementById('auth-status');
  if (!el) return;
  if (user) {
    el.innerHTML = `<span class="auth-name">${escapeHtml(user.displayName)}</span> · <a href="${api.logoutUrl}">Sign out</a>`;
  } else {
    el.innerHTML = `<a href="${api.loginUrl}">Sign in</a>`;
  }
}

function setupNavigation() {
  const nav = document.getElementById('header-nav');
  if (nav) {
    nav.querySelectorAll('a[data-page]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const page = a.dataset.page;
        history.pushState(null, '', `#${page}`);
        navigateTo(page);
      });
    });
  }
  window.addEventListener('popstate', () => {
    const hash = location.hash.replace('#', '') || 'groups';
    navigateTo(hash);
  });
}

function setActiveNav(page) {
  const navPage = (page === 'groups' || page === 'bracket') ? 'picks' : page;
  document.querySelectorAll('.header-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === navPage);
  });
}

async function navigateTo(page) {
  // Map 'picks' to 'groups' (slide panel entry point)
  if (page === 'picks') page = 'groups';

  setActiveNav(page);
  const app = document.getElementById('app');

  // Groups / Bracket → sliding panel
  if (page === 'groups' || page === 'bracket') {
    ensureSlidePanel(app, page);
    slideToPage(page);
    return;
  }

  // Other pages → tear down slider, render normally
  destroySlidePanel();
  app.innerHTML = '<div class="loading-screen"><p>Loading…</p></div>';

  switch (page) {
    case 'leaderboard':
      await renderLeaderboardPage(app);
      break;
    case 'leagues':
      await renderLeaguesPage(app);
      break;
    default:
      ensureSlidePanel(app, 'groups');
      slideToPage('groups');
  }
}

// ─── Slide Panel (Groups ↔ Bracket) ────────────────────────

function ensureSlidePanel(app, initialPage) {
  if (sliderActive) return;

  app.innerHTML = `
    <div class="slide-tabs" id="slide-tabs">
      <button class="active" data-slide="groups">Groups</button>
      <button data-slide="bracket">Bracket</button>
    </div>
    <div class="slide-container">
      <div class="slide-track">
        <div class="slide-panel slide-panel-groups"></div>
        <div class="slide-panel slide-panel-bracket"></div>
      </div>
      <div class="slide-peek-overlay slide-peek-right"></div>
      <div class="slide-peek-overlay slide-peek-left"></div>
    </div>
  `;

  renderGroupsPage(app.querySelector('.slide-panel-groups'));
  renderBracketPage(app.querySelector('.slide-panel-bracket'));

  sizeSlidePanels();
  sliderActive = true;
  currentSlide = initialPage;

  // Position instantly (no animation on first render)
  const track = app.querySelector('.slide-track');
  track.style.transition = 'none';
  positionTrack(initialPage);
  updateOverlay(initialPage);
  track.offsetHeight; // force reflow
  track.style.transition = '';

  // Click right peek overlay or bracket panel (in groups view) → navigate to bracket
  app.querySelector('.slide-peek-right')?.addEventListener('click', () => slideTo('bracket'));
  // Click left peek overlay → navigate back to groups
  app.querySelector('.slide-peek-left')?.addEventListener('click', () => slideTo('groups'));
  // Click anywhere on the bracket panel while in groups view → slide to bracket
  app.querySelector('.slide-panel-bracket')?.addEventListener('click', () => {
    if (currentSlide === 'groups') slideTo('bracket');
  });

  // Tab bar click handlers
  const tabBar = document.getElementById('slide-tabs');
  if (tabBar) {
    tabBar.querySelectorAll('button[data-slide]').forEach(btn => {
      btn.addEventListener('click', () => slideTo(btn.dataset.slide));
    });
  }

  // Keep bracket in sync with group picks
  let lastGroupSnap = serializeGroupState();
  unsubBracketSync = subscribe(() => {
    if (!sliderActive) return;
    const snap = serializeGroupState();
    if (snap !== lastGroupSnap) {
      lastGroupSnap = snap;
      renderBracketContent();
    }
  });

  // Touch swipe to slide between panels
  initSwipeGesture(app.querySelector('.slide-container'));
}

function destroySlidePanel() {
  if (!sliderActive) return;
  sliderActive = false;
  savedScrollY = { groups: 0, bracket: 0 };
  if (unsubBracketSync) { unsubBracketSync(); unsubBracketSync = null; }
}

/** Compute layout dimensions from container width. */
function getSlideLayout() {
  const ct = document.querySelector('.slide-container');
  if (!ct) return null;
  const w = ct.clientWidth;
  const peek = getPeekWidth();
  const gap = peek > 0 ? PANEL_GAP : 0;
  // Only cap groups width when peek is active; otherwise fill container
  const groupsW = peek > 0 ? Math.min(GROUPS_MAX_W, w - peek - gap) : w;
  const leftPeek = peek > 0 ? PEEK_LEFT : 0;
  return { ct, w, peek, gap, groupsW, leftPeek };
}

function sizeSlidePanels() {
  const lay = getSlideLayout();
  if (!lay) return;
  lay.ct.querySelector('.slide-panel-groups').style.width = lay.groupsW + 'px';
  lay.ct.querySelector('.slide-panel-bracket').style.width = lay.w + 'px';
  lay.ct.querySelector('.slide-track').style.gap = lay.gap + 'px';
}

function slideToPage(page) {
  if (currentSlide === page) return;
  // Save scroll position before sliding away
  savedScrollY[currentSlide] = window.scrollY;
  currentSlide = page;
  positionTrack(page);
  updateOverlay(page);
  // Restore scroll position for the target page
  requestAnimationFrame(() => window.scrollTo(0, savedScrollY[page] || 0));
}

/** Navigate to a slide page, updating the URL hash. */
function slideTo(page) {
  history.pushState(null, '', `#${page}`);
  navigateTo(page);
}

function positionTrack(page) {
  const lay = getSlideLayout();
  if (!lay) return;
  lay.ct.querySelector('.slide-track').style.transform = page === 'bracket'
    ? `translateX(-${lay.groupsW + lay.gap - lay.leftPeek}px)`
    : 'translateX(0)';
}

function updateOverlay(page) {
  const lay = getSlideLayout();
  const peek = lay?.peek ?? 0;
  const leftPeek = lay?.leftPeek ?? 0;

  const rightOv = document.querySelector('.slide-peek-right');
  if (rightOv) {
    rightOv.style.width = peek + 'px';
    rightOv.classList.toggle('active', page === 'groups' && peek > 0);
  }

  const leftOv = document.querySelector('.slide-peek-left');
  if (leftOv) {
    leftOv.style.width = leftPeek + 'px';
    leftOv.classList.toggle('active', page === 'bracket' && leftPeek > 0);
  }

  // Update tab bar active state
  document.querySelectorAll('#slide-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.slide === page);
  });
}

function getPeekWidth() {
  return window.innerWidth >= 900 ? PEEK_WIDTH : 0;
}

function serializeGroupState() {
  const { picks } = getState();
  return JSON.stringify({ gp: picks?.groupPicks, tpa: picks?.thirdPlaceAdvancing });
}

window.addEventListener('resize', () => {
  if (!sliderActive) return;
  sizeSlidePanels();
  positionTrack(currentSlide);
  updateOverlay(currentSlide);
});

// ─── Touch swipe gesture ────────────────────────────────────
const SWIPE_THRESHOLD = 50; // min px to trigger slide
let lastSwipeTime = 0;

function initSwipeGesture(container) {
  if (!container) return;
  let startX = 0, startY = 0, tracking = false;

  // Suppress ghost clicks that fire after a swipe (capture phase)
  container.addEventListener('click', e => {
    if (Date.now() - lastSwipeTime < 400) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  container.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  container.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;
    // Only trigger if horizontal swipe dominates vertical
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

    // When on bracket and swiping right (back to groups), only allow if
    // all bracket scroll areas are at the far left — otherwise the
    // user is just scrolling content, not trying to navigate.
    if (dx > 0 && currentSlide === 'bracket') {
      const scrollEls = container.querySelectorAll('.slide-panel-bracket .bk-scroll');
      const anyScrolled = Array.from(scrollEls).some(el => el.scrollLeft > 5);
      if (anyScrolled) return;
    }

    lastSwipeTime = Date.now();

    if (dx < 0 && currentSlide === 'groups') {
      slideTo('bracket');
    } else if (dx > 0 && currentSlide === 'bracket') {
      slideTo('groups');
    }
  }, { passive: true });
}

init().catch(console.error);
