// api.js — thin fetch wrapper for the SWA API

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || res.statusText), { status: res.status });
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  // Auth / profile
  getMe:         ()       => request('GET',  '/api/me'),
  updateMe:      (data)   => request('PUT',  '/api/me', data),

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

  // Auth helpers
  loginUrl:  '/.auth/login/aad?post_login_redirect_uri=/',
  logoutUrl: '/.auth/logout?post_logout_redirect_uri=/',
};
