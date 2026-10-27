/**
 * boardLayout.ts
 *
 * Visual layout and SVG coordinate calculator for the 15x15 Ludo board.
 * ViewBox: 0 0 600 600 (each cell is 40x40).
 */

import {
  PlayerColor,
  STEP_BASE,
  STEP_HOME_GOAL,
  isOnTrack,
  isInHomeLane,
  stepToGlobalTrackIndex,
  stepToHomeLaneIndex,
} from '@/engine';

export const CELL_SIZE = 40;
export const BOARD_SIZE = 600;

export interface Coord {
  x: number;
  y: number;
}

export interface GridCell {
  col: number;
  row: number;
}

/**
 * 52 shared track cells in clockwise order starting from Red start cell (0).
 */
export const TRACK_CELL_GRID: readonly GridCell[] = [
  // Red sector track
  { col: 1, row: 6 }, // 0: Red Start
  { col: 2, row: 6 }, // 1
  { col: 3, row: 6 }, // 2
  { col: 4, row: 6 }, // 3
  { col: 5, row: 6 }, // 4
  { col: 6, row: 5 }, // 5
  { col: 6, row: 4 }, // 6
  { col: 6, row: 3 }, // 7
  { col: 6, row: 2 }, // 8: Star Cell
  { col: 6, row: 1 }, // 9
  { col: 6, row: 0 }, // 10
  { col: 7, row: 0 }, // 11
  { col: 8, row: 0 }, // 12: Green Home Entry

  // Green sector track
  { col: 8, row: 1 }, // 13: Green Start
  { col: 8, row: 2 }, // 14
  { col: 8, row: 3 }, // 15
  { col: 8, row: 4 }, // 16
  { col: 8, row: 5 }, // 17
  { col: 9, row: 6 }, // 18
  { col: 10, row: 6 }, // 19
  { col: 11, row: 6 }, // 20
  { col: 12, row: 6 }, // 21: Star Cell
  { col: 13, row: 6 }, // 22
  { col: 14, row: 6 }, // 23
  { col: 14, row: 7 }, // 24
  { col: 14, row: 8 }, // 25: Yellow Home Entry

  // Yellow sector track
  { col: 13, row: 8 }, // 26: Yellow Start
  { col: 12, row: 8 }, // 27
  { col: 11, row: 8 }, // 28
  { col: 10, row: 8 }, // 29
  { col: 9, row: 8 }, // 30
  { col: 8, row: 9 }, // 31
  { col: 8, row: 10 }, // 32
  { col: 8, row: 11 }, // 33
  { col: 8, row: 12 }, // 34: Star Cell
  { col: 8, row: 13 }, // 35
  { col: 8, row: 14 }, // 36
  { col: 7, row: 14 }, // 37
  { col: 6, row: 14 }, // 38: Blue Home Entry

  // Blue sector track
  { col: 6, row: 13 }, // 39: Blue Start
  { col: 6, row: 12 }, // 40
  { col: 6, row: 11 }, // 41
  { col: 6, row: 10 }, // 42
  { col: 6, row: 9 }, // 43
  { col: 5, row: 8 }, // 44
  { col: 4, row: 8 }, // 45
  { col: 3, row: 8 }, // 46
  { col: 2, row: 8 }, // 47: Star Cell
  { col: 1, row: 8 }, // 48
  { col: 0, row: 8 }, // 49
  { col: 0, row: 7 }, // 50
  { col: 0, row: 6 }, // 51: Red Home Entry
] as const;

/**
 * 5 colored home lane cells for each color (leading towards center).
 */
export const HOME_LANES_GRID: Readonly<Record<PlayerColor, readonly GridCell[]>> = {
  red: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  green: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  yellow: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
  blue: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
};

/**
 * Base Yard seats (4 tokens per color yard) in SVG pixel coordinates.
 */
export const BASE_SPOTS: Readonly<Record<PlayerColor, readonly Coord[]>> = {
  red: [
    { x: 1.75 * CELL_SIZE + 20, y: 1.75 * CELL_SIZE + 20 },
    { x: 3.25 * CELL_SIZE + 20, y: 1.75 * CELL_SIZE + 20 },
    { x: 1.75 * CELL_SIZE + 20, y: 3.25 * CELL_SIZE + 20 },
    { x: 3.25 * CELL_SIZE + 20, y: 3.25 * CELL_SIZE + 20 },
  ],
  green: [
    { x: 10.75 * CELL_SIZE + 20, y: 1.75 * CELL_SIZE + 20 },
    { x: 12.25 * CELL_SIZE + 20, y: 1.75 * CELL_SIZE + 20 },
    { x: 10.75 * CELL_SIZE + 20, y: 3.25 * CELL_SIZE + 20 },
    { x: 12.25 * CELL_SIZE + 20, y: 3.25 * CELL_SIZE + 20 },
  ],
  yellow: [
    { x: 10.75 * CELL_SIZE + 20, y: 10.75 * CELL_SIZE + 20 },
    { x: 12.25 * CELL_SIZE + 20, y: 10.75 * CELL_SIZE + 20 },
    { x: 10.75 * CELL_SIZE + 20, y: 12.25 * CELL_SIZE + 20 },
    { x: 12.25 * CELL_SIZE + 20, y: 12.25 * CELL_SIZE + 20 },
  ],
  blue: [
    { x: 1.75 * CELL_SIZE + 20, y: 10.75 * CELL_SIZE + 20 },
    { x: 3.25 * CELL_SIZE + 20, y: 10.75 * CELL_SIZE + 20 },
    { x: 1.75 * CELL_SIZE + 20, y: 12.25 * CELL_SIZE + 20 },
    { x: 3.25 * CELL_SIZE + 20, y: 12.25 * CELL_SIZE + 20 },
  ],
};

/**
 * Center Goal token spots (each color finishes in its center triangle apex).
 */
export const CENTER_SPOTS: Readonly<Record<PlayerColor, Coord>> = {
  red: { x: 265, y: 300 },
  green: { x: 300, y: 265 },
  yellow: { x: 335, y: 300 },
  blue: { x: 300, y: 335 },
};

/**
 * Returns the center pixel coordinate of a grid cell.
 */
export function gridCellToCoord(cell: GridCell): Coord {
  return {
    x: cell.col * CELL_SIZE + CELL_SIZE / 2,
    y: cell.row * CELL_SIZE + CELL_SIZE / 2,
  };
}

/**
 * Returns the SVG (x, y) center coordinate for a token at a given step.
 */
export function getTokenCoord(
  color: PlayerColor,
  step: number,
  tokenIndex: number
): Coord {
  if (step === STEP_BASE) {
    return BASE_SPOTS[color][tokenIndex] || BASE_SPOTS[color][0];
  }

  if (step === STEP_HOME_GOAL) {
    // Add small offset per token index to show multiple finished tokens cleanly
    const base = CENTER_SPOTS[color];
    const offsets = [
      { x: 0, y: 0 },
      { x: -8, y: -8 },
      { x: 8, y: -8 },
      { x: 0, y: 8 },
    ];
    const off = offsets[tokenIndex] || { x: 0, y: 0 };
    return { x: base.x + off.x, y: base.y + off.y };
  }

  if (isOnTrack(step)) {
    const trackIndex = stepToGlobalTrackIndex(color, step)!;
    const gridCell = TRACK_CELL_GRID[trackIndex];
    return gridCellToCoord(gridCell);
  }

  if (isInHomeLane(step)) {
    const laneIdx = stepToHomeLaneIndex(step)!;
    const gridCell = HOME_LANES_GRID[color][laneIdx];
    return gridCellToCoord(gridCell);
  }

  return { x: 300, y: 300 };
}

/**
 * Generates an array of intermediate coordinates for step-by-step token movement.
 */
export function getStepPath(
  color: PlayerColor,
  fromStep: number,
  toStep: number,
  tokenIndex: number
): Coord[] {
  if (fromStep === STEP_BASE) {
    // Direct hop from yard into start cell
    return [
      getTokenCoord(color, STEP_BASE, tokenIndex),
      getTokenCoord(color, 0, tokenIndex),
    ];
  }

  const path: Coord[] = [];
  const start = Math.min(fromStep, toStep);
  const end = Math.max(fromStep, toStep);
  const forward = toStep >= fromStep;

  if (forward) {
    for (let s = start; s <= end; s++) {
      path.push(getTokenCoord(color, s, tokenIndex));
    }
  } else {
    for (let s = end; s >= start; s--) {
      path.push(getTokenCoord(color, s, tokenIndex));
    }
  }

  return path;
}
