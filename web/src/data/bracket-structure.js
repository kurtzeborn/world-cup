// FIFA World Cup 2026 — Bracket Structure
// All knockout matches defined by match number, round, and participants
// Participants are expressed as: "1X" (group winner), "2X" (runner-up), "W74" (winner of match 74), etc.
// Third-place slots are resolved dynamically using the THIRD_PLACE_TABLE.

export const ROUNDS = ['R32', 'R16', 'QF', 'SF', 'TPM', 'F'];

export const ROUND_POINTS = {
  R32: { full: 2, partial: 1 },
  R16: { full: 4, partial: 2 },
  QF:  { full: 8, partial: 4 },
  SF:  { full: 16, partial: 8 },
  TPM: { full: 16, partial: 8 },
  F:   { full: 32, partial: 16 },
};

// R32 matchups — match number, round, team A slot, team B slot
// Slot format: "1X" = group X winner, "2X" = group X runner-up
// "3P_74" = 3rd-place team assigned to match 74 (resolved from THIRD_PLACE_TABLE)
export const R32_MATCHES = [
  // Pathway 1 (Semifinal in Arlington)
  { match: 74, teamA: '1E', teamB: '3P_74' },   // GER vs 3rd ABCDF
  { match: 77, teamA: '1I', teamB: '3P_77' },   // FRA vs 3rd CDFGH
  { match: 73, teamA: '2A', teamB: '2B' },
  { match: 75, teamA: '1F', teamB: '2C' },       // NED vs 2C
  { match: 83, teamA: '2K', teamB: '2L' },
  { match: 84, teamA: '1H', teamB: '2J' },       // ESP vs 2J
  { match: 81, teamA: '1D', teamB: '3P_81' },   // USA vs 3rd BEFIJ
  { match: 82, teamA: '1G', teamB: '3P_82' },   // BEL vs 3rd AEHIJ

  // Pathway 2 (Semifinal in Atlanta)
  { match: 76, teamA: '1C', teamB: '2F' },       // BRA vs 2F
  { match: 78, teamA: '2E', teamB: '2I' },
  { match: 79, teamA: '1A', teamB: '3P_79' },   // MEX vs 3rd CEFHI
  { match: 80, teamA: '1L', teamB: '3P_80' },   // ENG vs 3rd EHIJK
  { match: 86, teamA: '1J', teamB: '2H' },       // ARG vs 2H
  { match: 88, teamA: '2D', teamB: '2G' },
  { match: 85, teamA: '1K', teamB: '3P_85' },   // POR vs 3rd EFGIJ
  { match: 87, teamA: '1B', teamB: '3P_87' },   // CAN vs 3rd DEIJL
];

// R16 matchups
export const R16_MATCHES = [
  { match: 89, teamA: 'W74', teamB: 'W77' },
  { match: 90, teamA: 'W73', teamB: 'W75' },
  { match: 91, teamA: 'W76', teamB: 'W78' },
  { match: 92, teamA: 'W79', teamB: 'W80' },
  { match: 93, teamA: 'W83', teamB: 'W84' },
  { match: 94, teamA: 'W81', teamB: 'W82' },
  { match: 95, teamA: 'W86', teamB: 'W88' },
  { match: 96, teamA: 'W85', teamB: 'W87' },
];

// Quarterfinals
export const QF_MATCHES = [
  { match: 97, teamA: 'W89', teamB: 'W90' },
  { match: 98, teamA: 'W93', teamB: 'W94' },
  { match: 99, teamA: 'W91', teamB: 'W92' },
  { match: 100, teamA: 'W95', teamB: 'W96' },
];

// Semifinals
export const SF_MATCHES = [
  { match: 101, teamA: 'W97', teamB: 'W98' },
  { match: 102, teamA: 'W99', teamB: 'W100' },
];

// Third-place match
export const TPM_MATCH = { match: 103, teamA: 'L101', teamB: 'L102' };

// Final
export const FINAL_MATCH = { match: 104, teamA: 'W101', teamB: 'W102' };

// All matches in order
export const ALL_MATCHES = [
  ...R32_MATCHES,
  ...R16_MATCHES,
  ...QF_MATCHES,
  ...SF_MATCHES,
  TPM_MATCH,
  FINAL_MATCH,
];

// Which round a match belongs to
export function getMatchRound(matchNum) {
  if (matchNum >= 73 && matchNum <= 88) return 'R32';
  if (matchNum >= 89 && matchNum <= 96) return 'R16';
  if (matchNum >= 97 && matchNum <= 100) return 'QF';
  if (matchNum === 101 || matchNum === 102) return 'SF';
  if (matchNum === 103) return 'TPM';
  if (matchNum === 104) return 'F';
  return null;
}

// 3rd-place slot → R32 match number mapping
// These are the 8 slots in the R32 that go to 3rd-place teams
export const THIRD_PLACE_SLOTS = [74, 77, 79, 80, 81, 82, 85, 87];

// Full bracket with id and round fields for easy filtering/lookup by bracket.js
export const BRACKET_STRUCTURE = ALL_MATCHES.map(m => ({
  ...m,
  id: m.match,
  round: getMatchRound(m.match),
}));

// Knockout match schedule — date & city (FIFA-marketed city names)
export const MATCH_SCHEDULE = {
  // Round of 32
  73:  { date: 'Jun 28', city: 'Los Angeles' },
  74:  { date: 'Jun 29', city: 'Boston' },
  75:  { date: 'Jun 29', city: 'Monterrey' },
  76:  { date: 'Jun 29', city: 'Houston' },
  77:  { date: 'Jun 30', city: 'New York/NJ' },
  78:  { date: 'Jun 30', city: 'Dallas' },
  79:  { date: 'Jun 30', city: 'Mexico City' },
  80:  { date: 'Jul 1',  city: 'Atlanta' },
  81:  { date: 'Jul 1',  city: 'San Francisco' },
  82:  { date: 'Jul 1',  city: 'Seattle' },
  83:  { date: 'Jul 2',  city: 'Toronto' },
  84:  { date: 'Jul 2',  city: 'Los Angeles' },
  85:  { date: 'Jul 2',  city: 'Vancouver' },
  86:  { date: 'Jul 3',  city: 'Miami' },
  87:  { date: 'Jul 3',  city: 'Kansas City' },
  88:  { date: 'Jul 3',  city: 'Dallas' },
  // Round of 16
  89:  { date: 'Jul 4',  city: 'Philadelphia' },
  90:  { date: 'Jul 4',  city: 'Houston' },
  91:  { date: 'Jul 5',  city: 'New York/NJ' },
  92:  { date: 'Jul 5',  city: 'Mexico City' },
  93:  { date: 'Jul 6',  city: 'Dallas' },
  94:  { date: 'Jul 6',  city: 'Seattle' },
  95:  { date: 'Jul 7',  city: 'Atlanta' },
  96:  { date: 'Jul 7',  city: 'Vancouver' },
  // Quarterfinals
  97:  { date: 'Jul 9',  city: 'Boston' },
  98:  { date: 'Jul 10', city: 'Los Angeles' },
  99:  { date: 'Jul 11', city: 'Miami' },
  100: { date: 'Jul 11', city: 'Kansas City' },
  // Semifinals
  101: { date: 'Jul 14', city: 'Dallas' },
  102: { date: 'Jul 15', city: 'Atlanta' },
  // Third place
  103: { date: 'Jul 18', city: 'Miami' },
  // Final
  104: { date: 'Jul 19', city: 'New York/NJ' },
};

