// state.js — simple reactive state store

let _state = {
  user: null,          // { userId, userDetails, ... } | null
  displayName: null,   // custom display name (from server profile)
  teams: [],           // all 48 teams
  picks: null,         // current user's picks (or null)
  results: null,       // match results
  leaderboard: [],
  leagues: [],
  locked: false,
};

const _listeners = new Set();

export function getState() {
  return _state;
}

export function setState(partial) {
  _state = { ..._state, ...partial };
  for (const fn of _listeners) fn(_state);
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
