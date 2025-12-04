// shared types
export type TeamKey = "boys" | "girls";
export type Rank = "Varsity" | "JV" | "Regular";

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number?: string;
  team: TeamKey;
  rank: Rank;
};

export type PerGame = {
  playerId: string | null; // who bowled this game (null if empty)
  score: number | null;
};

export type Series = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  level: string;
  location: string;
  team: TeamKey;
  // three per-game items (game1, game2, game3). For now each contains playerId + score.
  games: [PerGame, PerGame, PerGame];
  notes?: string;
};