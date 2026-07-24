// api.js — thin fetch wrapper for the SWA API

async function request(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);

  // If the response is HTML it means we were redirected to the SWA auth login
  // page (session expired). Treat it as a 401 so callers can react appropriately.
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw Object.assign(new Error('Session expired'), { status: 401, sessionExpired: true });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error || res.statusText || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return res.status === 204 ? null : res.json();
}

// Archive-mode API surface. All endpoints are public read-only.
export const api = {
  getUser:       (uid)    => request('GET',  `/api/me/${uid}`),
  getTeams:      ()       => request('GET',  '/api/teams'),
  getUserPicks:  (uid)    => request('GET',  `/api/picks/${uid}`),
  getResults:    ()       => request('GET',  '/api/results'),
  getLeaderboard:        ()     => request('GET', '/api/leaderboard'),
  getLeagueLeaderboard:  (lid)  => request('GET', `/api/leaderboard/${lid}`),
};
