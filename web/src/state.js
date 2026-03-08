// state.js — simple reactive state store

let _state = {
  user: null,          // { userId, displayName } | null
  teams: [],           // all 48 teams
  picks: null,         // current user's picks (or null)
  results: null,       // match results
  leaderboard: [],
  leagues: [],
  locked: false,
  lockDeadline: null,
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
