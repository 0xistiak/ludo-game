/**
 * types.ts
 *
 * Core TypeScript definitions for the pure Ludo game engine.
 * ZERO React or DOM dependencies.
 */

import { PlayerColor } from './geometry';

export type GameMode = '1v1' | '2v2';
export type TeamId = 'teamA' | 'teamB';

export interface LudoRuleset {
  /** If true, token must roll a 6 to move from base onto start cell */
  needSixToLeaveBase: boolean;
  /** If true, rolling a 6 grants an immediate extra roll */
  sixGivesExtraTurn: boolean;
  /** If true, rolling 3 sixes in a row forfeits the turn immediately */
  threeConsecutiveSixesLoss: boolean;
  /** If true, token must roll the exact number of steps to reach center home */
  exactRollToFinish: boolean;
  /** If true, capturing an opponent token grants an extra turn (default false) */
  captureGivesExtraTurn: boolean;
  /** If true, a token reaching center home grants an extra turn (default false) */
  homeFinishGivesExtraTurn: boolean;
  /** If true, star cells on the track protect tokens from capture */
  starCellsAreSafe: boolean;
  /** If true, start cells on the track protect tokens from capture */
  startCellsAreSafe: boolean;
}

export const DEFAULT_RULESET: Readonly<LudoRuleset> = {
  needSixToLeaveBase: true,
  sixGivesExtraTurn: true,
  threeConsecutiveSixesLoss: true,
  exactRollToFinish: true,
  captureGivesExtraTurn: false,
  homeFinishGivesExtraTurn: false,
  starCellsAreSafe: true,
  startCellsAreSafe: true,
};

export interface Token {
  id: string; // e.g. "red_0", "green_2"
  color: PlayerColor;
  index: number; // 0..3
  step: number; // -1 for base, 0..51 for track, 52..56 for home lane, 57 for center home
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  team?: TeamId;
  tokenIds: string[]; // 4 tokens per player
}

export type TurnPhase = 'need_roll' | 'need_move' | 'game_over';

export interface GameConfig {
  mode: GameMode;
  players: {
    name: string;
    color: PlayerColor;
  }[];
  rules?: Partial<LudoRuleset>;
}

export interface MoveRecord {
  tokenId: string;
  playerColor: PlayerColor;
  fromStep: number;
  toStep: number;
  roll: number;
  capturedTokenIds: string[];
  reachedHome: boolean;
  awardedExtraTurn: boolean;
  reason?: string;
}

export interface GameState {
  config: GameConfig;
  mode: GameMode;
  rules: LudoRuleset;
  players: Player[];
  activePlayerIndex: number;
  phase: TurnPhase;
  currentRoll: number | null;
  consecutiveSixes: number;
  tokens: Record<string, Token>;
  legalMoves: string[]; // tokenIds that can legally move with currentRoll
  winner: PlayerColor | TeamId | null;
  winnerTeam?: TeamId | null;
  lastMove: MoveRecord | null;
  turnCount: number;
  log: string[];
}

export type RNG = () => number;
