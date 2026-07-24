// main.js — archive-mode app entry point
// The tournament is over. The site is now a read-only, anonymous archive.

import { api } from './api.js';
import { setState } from './state.js';
import { renderLeaderboardPage } from './pages/leaderboard.js';
import { renderRulesPage } from './pages/rules.js';
import { renderViewPicksPage } from './pages/view-picks.js';

// --- Dark Mode ---
function initTheme() {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);

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

  // Load teams + results (both public in archive mode)
  const [teams, results] = await Promise.all([
    api.getTeams().catch(() => []),
    api.getResults().catch(() => ({})),
  ]);

  setState({ user: null, teams, results, locked: true });

  setupNavigation();
  const path = location.pathname.replace(/^\//, '') || 'leaderboard';
  navigateTo(path);
}

function setupNavigation() {
  const nav = document.getElementById('header-nav');
  if (nav) {
    nav.querySelectorAll('a[data-page]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const page = a.dataset.page;
        history.pushState(null, '', `/${page}`);
        navigateTo(page);
      });
    });
  }
  // Intercept internal <a> links for SPA navigation
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('/.auth') || href.startsWith('/api')) return;
    if (href.startsWith('/')) {
      e.preventDefault();
      history.pushState(null, '', href);
      navigateTo(href.replace(/^\//, '') || 'leaderboard');
    }
  });
  window.addEventListener('popstate', () => {
    const path = location.pathname.replace(/^\//, '') || 'leaderboard';
    navigateTo(path);
  });
}

function setActiveNav(page) {
  document.querySelectorAll('.header-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

async function navigateTo(page) {
  const app = document.getElementById('app');

  // view-picks/:userId
  const viewPicksMatch = page.match(/^view-picks\/(.+)$/);
  if (viewPicksMatch) {
    app.innerHTML = '<div class="loading-screen"><p>Loading…</p></div>';
    setActiveNav('');
    await renderViewPicksPage(app, viewPicksMatch[1]);
    return;
  }

  // leaderboard/:leagueId
  const leagueMatch = page.match(/^leaderboard\/(.+)$/);
  if (leagueMatch) {
    setActiveNav('leaderboard');
    app.innerHTML = '<div class="loading-screen"><p>Loading…</p></div>';
    await renderLeaderboardPage(app, leagueMatch[1]);
    return;
  }

  setActiveNav(page);
  app.innerHTML = '<div class="loading-screen"><p>Loading…</p></div>';

  switch (page) {
    case 'rules':
      renderRulesPage(app);
      break;
    case 'leaderboard':
      await renderLeaderboardPage(app);
      break;
    default:
      // All legacy routes (picks, groups, bracket, dashboard, leagues, admin…)
      // redirect to the leaderboard.
      history.replaceState(null, '', '/leaderboard');
      setActiveNav('leaderboard');
      await renderLeaderboardPage(app);
  }
}

init();
