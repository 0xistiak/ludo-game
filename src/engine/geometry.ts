/**
 * geometry.ts
 *
 * Single documented source of truth for the Ludo board geometry.
 * All game logic uses purely discrete cell indices and relative steps.
 * ZERO dependencies on UI, rendering, or screen position.
 */

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export const COLORS: readonly PlayerColor[] = ['red', 'green', 'yellow', 'blue'] as const;

/** Total cells on the shared common track */
export const TOTAL_TRACK_CELLS = 52;

/** Total cells in each player's colored home lane leading to center (indices 0..4 + center 5) */
export const HOME_LANE_CELLS = 6;

/**
 * Global track index where each color's token enters after rolling a 6 from base.
 * Clockwise: Red (0) -> Green (13) -> Yellow (26) -> Blue (39)
 */
export const START_CELLS: Readonly<Record<PlayerColor, number>> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/**
 * Global track index right before entering the home lane.
 * When a token is at this cell and advances, it enters its private colored home lane.
 */
export const ENTRY_CELLS_TO_HOME_LANE: Readonly<Record<PlayerColor, number>> = {
  red: 51,
  green: 12,
  yellow: 25,
  blue: 38,
};

/**
 * Safe cells on the shared 52-cell track:
 * - 4 Start cells: 0 (Red), 13 (Green), 26 (Yellow), 39 (Blue)
 * - 4 Star cells: 8 (Red sector), 21 (Green sector), 34 (Yellow sector), 47 (Blue sector)
 */
export const STAR_CELLS: readonly number[] = [8, 21, 34, 47] as const;

export const SAFE_TRACK_CELLS: readonly number[] = [
  START_CELLS.red,
  STAR_CELLS[0], // 8
  START_CELLS.green,
  STAR_CELLS[1], // 21
  START_CELLS.yellow,
  STAR_CELLS[2], // 34
  START_CELLS.blue,
  STAR_CELLS[3], // 47
] as const;

/** Quick lookup set for safe cells */
export const SAFE_CELLS_SET: ReadonlySet<number> = new Set<number>(SAFE_TRACK_CELLS);

/**
 * Discrete Step Definitions for a Token:
 * - STEP_BASE (-1): In player's yard/base
 * - STEP_START (0): On shared track at START_CELLS[color]
 * - STEP_TRACK_MAX (51): On shared track at ENTRY_CELLS_TO_HOME_LANE[color]
 * - STEP_HOME_LANE_START (52): First cell of colored home lane (lane index 0)
 * - STEP_HOME_GOAL (57): Center Home finish (goal reached, completed)
 */
export const STEP_BASE = -1;
export const STEP_START = 0;
export const STEP_TRACK_MAX = 51; // 52 steps on common track (0 to 51)
export const STEP_HOME_LANE_START = 52;
export const STEP_HOME_GOAL = 57; // 52 + 5 home lane cells + center = 57

export function isBase(step: number): boolean {
  return step === STEP_BASE;
}

export function isHome(step: number): boolean {
  return step === STEP_HOME_GOAL;
}

export function isOnTrack(step: number): boolean {
  return step >= STEP_START && step <= STEP_TRACK_MAX;
}

export function isInHomeLane(step: number): boolean {
  return step >= STEP_HOME_LANE_START && step < STEP_HOME_GOAL;
}

/**
 * Converts a player's color and step (0..51) to the global track index (0..51).
 * Returns null if the token is in base or home lane / center.
 */
export function stepToGlobalTrackIndex(color: PlayerColor, step: number): number | null {
  if (!isOnTrack(step)) return null;
  return (START_CELLS[color] + step) % TOTAL_TRACK_CELLS;
}

/**
 * Converts a player's step (52..56) to their home lane index (0..4).
 * Returns null if not in the home lane.
 */
export function stepToHomeLaneIndex(step: number): number | null {
  if (!isInHomeLane(step)) return null;
  return step - STEP_HOME_LANE_START;
}

/**
 * Checks whether a given global track cell is safe from capture.
 */
export function isSafeTrackCell(cellIndex: number): boolean {
  return SAFE_CELLS_SET.has(cellIndex);
}

/**
 * Returns the opposite color across the board (180 degrees).
 * Used for 1v1 duels and 2v2 teammates:
 * Red <-> Yellow
 * Green <-> Blue
 */
export function getOppositeColor(color: PlayerColor): PlayerColor {
  switch (color) {
    case 'red':
      return 'yellow';
    case 'yellow':
      return 'red';
    case 'green':
      return 'blue';
    case 'blue':
      return 'green';
  }
}
