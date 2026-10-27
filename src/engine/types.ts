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
  /** If true, capturing an opponent token grants an extra turn (classic Ludo King: true) */
  captureGivesExtraTurn: boolean;
  /** If true, a token reaching center home grants an extra turn (classic Ludo King: true) */
  homeFinishGivesExtraTurn: boolean;
  /** If true, star cells on the track protect tokens from capture */
  starCellsAreSafe: boolean;
  /** If true, start cells on the track protect tokens from capture */
  startCellsAreSafe: boolean;
  /** If true, two or more same-color tokens forming a stack/block cannot be captured (default: false) */
  blockCannotBeCaptured: boolean;
  /** If true, player with all active tokens in base gets up to 3 roll attempts per turn to roll a 6 */
  threeRollAttemptsInBase: boolean;
}

export const DEFAULT_RULESET: Readonly<LudoRuleset> = {
  needSixToLeaveBase: true,
  sixGivesExtraTurn: true,
  threeConsecutiveSixesLoss: true,
  exactRollToFinish: true,
  captureGivesExtraTurn: true,
  homeFinishGivesExtraTurn: true,
  starCellsAreSafe: true,
  startCellsAreSafe: true,
  blockCannotBeCaptured: false,
  threeRollAttemptsInBase: true,
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

export type TurnPhase = 'awaiting-roll' | 'awaiting-move' | 'game_over' | 'need_roll' | 'need_move';

export interface GameConfig {
  mode: GameMode;
  players: {
    name: string;
    color: PlayerColor;
  }[];
  rules?: Partial<LudoRuleset>;
}

export type BonusRollReason = 'six' | 'capture' | 'home';

export interface BonusRollState {
  hasBonus: boolean;
  reason: BonusRollReason | null;
}

export interface MoveRecord {
  tokenId: string;
  playerColor: PlayerColor;
  from: number;
  to: number;
  path: number[]; // Discrete steps traversed, e.g. [0, 1, 2, 3, 4] or [-1, 0]
  capturedTokenIds: string[];
  reachedHome: boolean;
  awardedExtraTurn: boolean;
  bonusReason?: BonusRollReason | null;
  roll: number;
  // Aliases for backward compatibility
  fromStep?: number;
  toStep?: number;
  reason?: string;
}

export interface GameState {
  config: GameConfig;
  mode: GameMode;
  rules: LudoRuleset;
  players: Player[];
  activePlayerIndex: number;
  currentPlayer: PlayerColor; // Active player's color
  phase: TurnPhase;
  diceValue: number | null; // Current roll value
  currentRoll: number | null; // Alias for diceValue
  consecutiveSixes: number;
  rollAttempts: number; // 0..3 attempts in base
  bonusRoll: BonusRollState | null;
  tokens: Record<string, Token>;
  legalMoves: string[]; // De-duplicated legal choices
  winner: PlayerColor | TeamId | null;
  winnerTeam?: TeamId | null;
  lastMove: MoveRecord | null;
  turnCount: number;
  log: string[];
}

export type RNG = () => number;
