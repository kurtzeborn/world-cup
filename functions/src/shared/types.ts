export interface TeamEntity {
  name: string;
  group: string;
  groupSeed: number;
  flagCode: string;
  fifaRanking: number;
  confirmed: boolean;
}

export interface UserEntity {
  displayName: string;
  email: string;
  authProvider: string;
  createdAt: string;
  updatedAt: string;
}

export interface PicksEntity {
  groupPicks: string;      // JSON: { "A": ["MEX","KOR","RSA","TBD_UEFAD"], ... }
  thirdPlaceAdvancing: string; // JSON: ["A","C","E","F","G","H","J","K"]
  bracketPicks: string;    // JSON: { "R32_74": "GER", ... }
  lockedAt: string | null;
  updatedAt: string;
}

export interface ResultEntity {
  data: string;  // JSON: { groupStandings, advancing3rdPlace, matchResults, updatedAt }
  enteredBy: string;
  enteredAt: string;
}

export interface Results {
  groupStandings: Record<string, string[]>;  // { "A": ["MEX", "KOR", "RSA", "URY"], ... }
  advancing3rdPlace: string[];               // 8 team IDs that advanced from 3rd place
  matchResults: Record<string, { winner: string; loser: string; score?: string }>;
  updatedAt?: string;
}

export interface LeagueEntity {
  name: string;
  joinCode: string;
  createdBy: string;
  createdAt: string;
}

export interface LeagueMemberEntity {
  joinedAt: string;
  displayName: string;
}

export interface ScoreEntity {
  totalPoints: number;
  groupPoints: number;
  thirdPlacePoints: number;
  knockoutPoints: number;
  maxPossiblePoints: number;
  breakdown: string; // JSON
  calculatedAt: string;
}

export function getLockDeadline(): Date {
  const raw = process.env.LOCK_DEADLINE || '2026-06-11T19:00:00Z';
  return new Date(raw);
}

export function isLocked(): boolean {
  return new Date() >= getLockDeadline();
}
