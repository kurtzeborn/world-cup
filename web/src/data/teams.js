// FIFA World Cup 2026 — Team Data
// All 48 teams with stable IDs, groups, seeds, flag codes, and FIFA rankings (March 2026)
// TBD teams use placeholder IDs prefixed with "TBD_"
// FIFA rankings as of November 2025 (used for draw seeding; update periodically via admin)

export interface Team {
  id: string;
  name: string;
  group: string;
  groupSeed: number; // 1–4 within group
  flagCode: string;  // ISO 3166-1 alpha-2 for flagcdn.com
  fifaRanking: number;
  confirmed: boolean; // false for TBD playoff teams
}

export const TEAMS: Team[] = [
  // Group A
  { id: 'MEX', name: 'Mexico', group: 'A', groupSeed: 1, flagCode: 'mx', fifaRanking: 16, confirmed: true },
  { id: 'RSA', name: 'South Africa', group: 'A', groupSeed: 2, flagCode: 'za', fifaRanking: 62, confirmed: true },
  { id: 'KOR', name: 'South Korea', group: 'A', groupSeed: 3, flagCode: 'kr', fifaRanking: 23, confirmed: true },
  { id: 'TBD_UEFAD', name: 'UEFA Path D', group: 'A', groupSeed: 4, flagCode: 'xx', fifaRanking: 999, confirmed: false },

  // Group B
  { id: 'CAN', name: 'Canada', group: 'B', groupSeed: 1, flagCode: 'ca', fifaRanking: 48, confirmed: true },
  { id: 'TBD_UEFAA', name: 'UEFA Path A', group: 'B', groupSeed: 2, flagCode: 'xx', fifaRanking: 999, confirmed: false },
  { id: 'QAT', name: 'Qatar', group: 'B', groupSeed: 3, flagCode: 'qa', fifaRanking: 61, confirmed: true },
  { id: 'SUI', name: 'Switzerland', group: 'B', groupSeed: 4, flagCode: 'ch', fifaRanking: 20, confirmed: true },

  // Group C
  { id: 'BRA', name: 'Brazil', group: 'C', groupSeed: 1, flagCode: 'br', fifaRanking: 5, confirmed: true },
  { id: 'MAR', name: 'Morocco', group: 'C', groupSeed: 2, flagCode: 'ma', fifaRanking: 14, confirmed: true },
  { id: 'HAI', name: 'Haiti', group: 'C', groupSeed: 3, flagCode: 'ht', fifaRanking: 83, confirmed: true },
  { id: 'SCO', name: 'Scotland', group: 'C', groupSeed: 4, flagCode: 'gb-sct', fifaRanking: 38, confirmed: true },

  // Group D
  { id: 'USA', name: 'United States', group: 'D', groupSeed: 1, flagCode: 'us', fifaRanking: 13, confirmed: true },
  { id: 'PAR', name: 'Paraguay', group: 'D', groupSeed: 2, flagCode: 'py', fifaRanking: 60, confirmed: true },
  { id: 'AUS', name: 'Australia', group: 'D', groupSeed: 3, flagCode: 'au', fifaRanking: 24, confirmed: true },
  { id: 'TBD_UEFAC', name: 'UEFA Path C', group: 'D', groupSeed: 4, flagCode: 'xx', fifaRanking: 999, confirmed: false },

  // Group E
  { id: 'GER', name: 'Germany', group: 'E', groupSeed: 1, flagCode: 'de', fifaRanking: 12, confirmed: true },
  { id: 'CUW', name: 'Curaçao', group: 'E', groupSeed: 2, flagCode: 'cw', fifaRanking: 79, confirmed: true },
  { id: 'CIV', name: 'Ivory Coast', group: 'E', groupSeed: 3, flagCode: 'ci', fifaRanking: 34, confirmed: true },
  { id: 'ECU', name: 'Ecuador', group: 'E', groupSeed: 4, flagCode: 'ec', fifaRanking: 42, confirmed: true },

  // Group F
  { id: 'NED', name: 'Netherlands', group: 'F', groupSeed: 1, flagCode: 'nl', fifaRanking: 7, confirmed: true },
  { id: 'JPN', name: 'Japan', group: 'F', groupSeed: 2, flagCode: 'jp', fifaRanking: 15, confirmed: true },
  { id: 'TBD_UEFAB', name: 'UEFA Path B', group: 'F', groupSeed: 3, flagCode: 'xx', fifaRanking: 999, confirmed: false },
  { id: 'TUN', name: 'Tunisia', group: 'F', groupSeed: 4, flagCode: 'tn', fifaRanking: 47, confirmed: true },

  // Group G
  { id: 'BEL', name: 'Belgium', group: 'G', groupSeed: 1, flagCode: 'be', fifaRanking: 3, confirmed: true },
  { id: 'EGY', name: 'Egypt', group: 'G', groupSeed: 2, flagCode: 'eg', fifaRanking: 36, confirmed: true },
  { id: 'IRN', name: 'Iran', group: 'G', groupSeed: 3, flagCode: 'ir', fifaRanking: 22, confirmed: true },
  { id: 'NZL', name: 'New Zealand', group: 'G', groupSeed: 4, flagCode: 'nz', fifaRanking: 95, confirmed: true },

  // Group H
  { id: 'ESP', name: 'Spain', group: 'H', groupSeed: 1, flagCode: 'es', fifaRanking: 1, confirmed: true },
  { id: 'CPV', name: 'Cape Verde', group: 'H', groupSeed: 2, flagCode: 'cv', fifaRanking: 73, confirmed: true },
  { id: 'KSA', name: 'Saudi Arabia', group: 'H', groupSeed: 3, flagCode: 'sa', fifaRanking: 56, confirmed: true },
  { id: 'URU', name: 'Uruguay', group: 'H', groupSeed: 4, flagCode: 'uy', fifaRanking: 17, confirmed: true },

  // Group I
  { id: 'FRA', name: 'France', group: 'I', groupSeed: 1, flagCode: 'fr', fifaRanking: 2, confirmed: true },
  { id: 'SEN', name: 'Senegal', group: 'I', groupSeed: 2, flagCode: 'sn', fifaRanking: 26, confirmed: true },
  { id: 'TBD_ICP2', name: 'IC Path 2', group: 'I', groupSeed: 3, flagCode: 'xx', fifaRanking: 999, confirmed: false },
  { id: 'NOR', name: 'Norway', group: 'I', groupSeed: 4, flagCode: 'no', fifaRanking: 29, confirmed: true },

  // Group J
  { id: 'ARG', name: 'Argentina', group: 'J', groupSeed: 1, flagCode: 'ar', fifaRanking: 4, confirmed: true },
  { id: 'ALG', name: 'Algeria', group: 'J', groupSeed: 2, flagCode: 'dz', fifaRanking: 52, confirmed: true },
  { id: 'AUT', name: 'Austria', group: 'J', groupSeed: 3, flagCode: 'at', fifaRanking: 27, confirmed: true },
  { id: 'JOR', name: 'Jordan', group: 'J', groupSeed: 4, flagCode: 'jo', fifaRanking: 70, confirmed: true },

  // Group K
  { id: 'POR', name: 'Portugal', group: 'K', groupSeed: 1, flagCode: 'pt', fifaRanking: 6, confirmed: true },
  { id: 'TBD_ICP1', name: 'IC Path 1', group: 'K', groupSeed: 2, flagCode: 'xx', fifaRanking: 999, confirmed: false },
  { id: 'UZB', name: 'Uzbekistan', group: 'K', groupSeed: 3, flagCode: 'uz', fifaRanking: 69, confirmed: true },
  { id: 'COL', name: 'Colombia', group: 'K', groupSeed: 4, flagCode: 'co', fifaRanking: 19, confirmed: true },

  // Group L
  { id: 'ENG', name: 'England', group: 'L', groupSeed: 1, flagCode: 'gb-eng', fifaRanking: 8, confirmed: true },
  { id: 'CRO', name: 'Croatia', group: 'L', groupSeed: 2, flagCode: 'hr', fifaRanking: 11, confirmed: true },
  { id: 'GHA', name: 'Ghana', group: 'L', groupSeed: 3, flagCode: 'gh', fifaRanking: 59, confirmed: true },
  { id: 'PAN', name: 'Panama', group: 'L', groupSeed: 4, flagCode: 'pa', fifaRanking: 49, confirmed: true },
];

// Keyed by team ID for fast lookup
export const TEAMS_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map(t => [t.id, t]));

// Grouped by group letter
export const TEAMS_BY_GROUP: Record<string, Team[]> = {};
for (const team of TEAMS) {
  if (!TEAMS_BY_GROUP[team.group]) TEAMS_BY_GROUP[team.group] = [];
  TEAMS_BY_GROUP[team.group].push(team);
}
// Sort each group by seed
for (const group of Object.values(TEAMS_BY_GROUP)) {
  group.sort((a, b) => a.groupSeed - b.groupSeed);
}

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
