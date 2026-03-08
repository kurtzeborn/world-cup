// main.js — app entry point

import { fetchAuthUser } from './auth.js';
import { api } from './api.js';
import { getState, setState } from './state.js';
import { renderGroupsPage } from './pages/groups.js';
import { renderBracketPage } from './pages/bracket.js';
import { renderLeaderboardPage } from './pages/leaderboard.js';
import { renderLeaguesPage } from './pages/leagues.js';

const LOCK_DEADLINE_DEV = '2026-06-11T19:00:00Z'; // fallback

async function init() {
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
    el.innerHTML = `${escapeHtml(user.displayName)} · <a href="${api.logoutUrl}">Sign out</a>`;
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
  document.querySelectorAll('.header-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

async function navigateTo(page) {
  setActiveNav(page);
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading-screen"><p>Loading…</p></div>';

  switch (page) {
    case 'groups':
      renderGroupsPage(app);
      break;
    case 'bracket':
      renderBracketPage(app);
      break;
    case 'leaderboard':
      await renderLeaderboardPage(app);
      break;
    case 'leagues':
      await renderLeaguesPage(app);
      break;
    default:
      renderGroupsPage(app);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

init().catch(console.error);
