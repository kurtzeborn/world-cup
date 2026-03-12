// api.js — thin fetch wrapper for the SWA API

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error || res.statusText || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  // Auth / profile
  getMe:         ()       => request('GET',  '/api/me'),
  updateMe:      (data)   => request('PUT',  '/api/me', data),
  getUser:       (uid)    => request('GET',  `/api/me/${uid}`),

  // Teams
  getTeams:      ()       => request('GET',  '/api/teams'),

  // Picks
  getPicks:      ()       => request('GET',  '/api/picks'),
  savePicks:     (data)   => request('PUT',  '/api/picks', data),
  lockPicks:     ()       => request('POST', '/api/picks/lock', {}),
  getUserPicks:  (uid)    => request('GET',  `/api/picks/${uid}`),

  // Results
  getResults:    ()       => request('GET',  '/api/results'),

  // Leaderboard
  getLeaderboard:        ()     => request('GET', '/api/leaderboard'),
  getLeagueLeaderboard:  (lid)  => request('GET', `/api/leaderboard/${lid}`),

  // Leagues
  getLeagues:    ()       => request('GET',  '/api/leagues'),
  createLeague:  (data)   => request('POST', '/api/leagues', data),
  joinLeague:    (data)   => request('POST', '/api/leagues/join', data),

  // Admin
  submitAdminResults: (data) => request('POST', '/api/manage/results', data),
  recalculateScores: ()      => request('POST', '/api/manage/recalculate', {}),
  adminLockAllPicks: ()      => request('POST', '/api/manage/lock-all', {}),
  adminUnlockAllPicks: ()    => request('POST', '/api/manage/unlock-all', {}),
  clearResults:      ()      => request('DELETE', '/api/manage/results'),
  getAdminUsers:     ()      => request('GET', '/api/manage/users'),
  deleteUserPicks:   (uid)   => request('DELETE', `/api/manage/picks/${uid}`),

  // Auth helpers
  loginUrl:  '/.auth/login/aad?post_login_redirect_uri=/',
  loginGoogleUrl: '/.auth/login/google?post_login_redirect_uri=/',
  logoutUrl: '/.auth/logout?post_logout_redirect_uri=/',
};
