/**
 * engine.ts
 *
 * Pure, deterministic Ludo game engine following classic Ludo King / Ludo Star behavior.
 * Zero React or DOM imports.
 * Fully injectable RNG for deterministic testing and server-authoritative play.
 */

import {
  PlayerColor,
  SAFE_CELLS_SET,
  STEP_BASE,
  STEP_START,
  STEP_HOME_GOAL,
  isOnTrack,
  stepToGlobalTrackIndex,
  getOppositeColor,
} from './geometry';
import {
  GameConfig,
  GameState,
  LudoRuleset,
  DEFAULT_RULESET,
  Player,
  Token,
  RNG,
  TeamId,
  MoveRecord,
  BonusRollReason,
  RevertedTokenMove,
} from './types';

/**
 * Creates a brand new game state from configuration.
 */
export function createGame(config: GameConfig): GameState {
  const rules: LudoRuleset = {
    ...DEFAULT_RULESET,
    ...config.rules,
  };

  const mode = config.mode;
  let players: Player[] = [];

  if (mode === '1v1') {
    // 1v1 mode: 2 active players with opposite colors
    if (config.players.length < 2) {
      throw new Error('1v1 mode requires 2 players');
    }
    const p1Color = config.players[0].color;
    const opposite = getOppositeColor(p1Color);
    const p2Color = config.players[1]?.color === opposite ? opposite : opposite;

    players = [
      {
        id: `p_${p1Color}`,
        name: config.players[0].name || `Player 1 (${p1Color})`,
        color: p1Color,
        tokenIds: [0, 1, 2, 3].map((i) => `${p1Color}_${i}`),
      },
      {
        id: `p_${p2Color}`,
        name: config.players[1]?.name || `Player 2 (${p2Color})`,
        color: p2Color,
        tokenIds: [0, 1, 2, 3].map((i) => `${p2Color}_${i}`),
      },
    ];
  } else {
    // 2v2 mode: 4 players. Opposite colors are teammates.
    // Team A: Red + Yellow (diagonal opposites)
    // Team B: Green + Blue (diagonal opposites)
    const order: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    players = order.map((color) => {
      const cfg = config.players.find((p) => p.color === color);
      const team: TeamId = color === 'red' || color === 'yellow' ? 'teamA' : 'teamB';
      return {
        id: `p_${color}`,
        name: cfg?.name || color.toUpperCase(),
        color,
        team,
        tokenIds: [0, 1, 2, 3].map((i) => `${color}_${i}`),
      };
    });
  }

  const tokens: Record<string, Token> = {};
  for (const player of players) {
    for (let i = 0; i < 4; i++) {
      const id = `${player.color}_${i}`;
      tokens[id] = {
        id,
        color: player.color,
        index: i,
        step: STEP_BASE,
      };
    }
  }

  return {
    config,
    mode,
    rules,
    players,
    activePlayerIndex: 0,
    currentPlayer: players[0].color,
    phase: 'awaiting-roll',
    diceValue: null,
    currentRoll: null,
    consecutiveSixes: 0,
    turnStartSnapshot: { ...tokens },
    revertedTurn: null,
    bonusRoll: null,
    tokens,
    legalMoves: [],
    winner: null,
    winnerTeam: null,
    lastMove: null,
    lastDiceRoll: null,
    rollSeq: 0,
    turnCount: 1,
    log: ['Game started'],
  };
}

/**
 * Returns the player whose tokens are currently controllable by the active player.
 * In 2v2: when a player has finished all 4 tokens home, on their turn they roll and
 * move their TEAMMATE's tokens.
 */
export function getControllablePlayer(state: GameState, player: Player): Player {
  if (state.mode === '2v2' && player.team) {
    const allHome = player.tokenIds.every(
      (id) => state.tokens[id]?.step === STEP_HOME_GOAL
    );
    if (allHome) {
      const teammate = state.players.find(
        (p) => p.team === player.team && p.id !== player.id
      );
      if (teammate) {
        return teammate;
      }
    }
  }
  return player;
}

/**
 * Checks if all controllable unfinished tokens for the player are in base (none on board, none in home lane).
 * When true, the player gets up to 3 roll attempts per turn to roll a 6.
 */
export function isPlayerAllInBase(state: GameState, player: Player): boolean {
  const tokens = player.tokenIds.map((id) => state.tokens[id]).filter(Boolean);
  const hasUnfinishedBase = tokens.some((t) => t.step === STEP_BASE);
  const hasActiveOnBoard = tokens.some(
    (t) => t.step >= STEP_START && t.step < STEP_HOME_GOAL
  );
  return hasUnfinishedBase && !hasActiveOnBoard;
}

/**
 * Returns the de-duplicated list of token IDs that can legally move given the current roll.
 * - All tokens in base represent ONE choice (tapping any base token brings one out).
 * - Two same-color tokens on the exact same cell represent ONE choice.
 */
export function getLegalMoves(state: GameState, rollOverride?: number): string[] {
  if (state.phase === 'game_over' || state.winner !== null) {
    return [];
  }

  const roll = rollOverride ?? state.diceValue ?? state.currentRoll;
  if (roll === null || roll < 1 || roll > 6) {
    return [];
  }

  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer) return [];

  const controllablePlayer = getControllablePlayer(state, activePlayer);
  const candidateIds: string[] = [];

  for (const tokenId of controllablePlayer.tokenIds) {
    const token = state.tokens[tokenId];
    if (!token) continue;

    // Token in base: needs 6 to enter start cell (if needSixToLeaveBase rule is enabled)
    if (token.step === STEP_BASE) {
      if (roll === 6 || !state.rules.needSixToLeaveBase) {
        candidateIds.push(tokenId);
      }
      continue;
    }

    // Token already in center home cannot move
    if (token.step === STEP_HOME_GOAL) {
      continue;
    }

    // Token on track or in home lane
    const targetStep = token.step + roll;

    if (targetStep > STEP_HOME_GOAL) {
      // Overshot the goal!
      if (!state.rules.exactRollToFinish) {
        candidateIds.push(tokenId);
      }
      // If exact roll needed, this token cannot move
      continue;
    }

    // Target step <= STEP_HOME_GOAL: valid move
    candidateIds.push(tokenId);
  }

  // De-duplicate equivalent choices:
  // 1. All tokens in base (step === STEP_BASE) count as ONE choice.
  // 2. Tokens of the same color on the same cell (step === same) count as ONE choice.
  const seenFromSteps = new Set<number>();
  const dedupedLegalMoves: string[] = [];

  for (const tokenId of candidateIds) {
    const token = state.tokens[tokenId];
    if (!seenFromSteps.has(token.step)) {
      seenFromSteps.add(token.step);
      dedupedLegalMoves.push(tokenId);
    }
  }

  return dedupedLegalMoves;
}

/**
 * Helper: if exactly ONE legal choice exists, returns that tokenId for auto-move.
 * Otherwise returns null (0 choices or 2+ distinct choices).
 */
export function getAutoMove(state: GameState): string | null {
  if (state.phase !== 'awaiting-move' && state.phase !== 'need_move') {
    return null;
  }
  const moves = state.legalMoves;
  if (moves.length === 1) {
    return moves[0];
  }
  return null;
}

/**
 * Unbiased, cryptographically secure uniform random integer in [1, 6]
 * using rejection sampling to eliminate modulo bias.
 * Used identically by local gameplay and online server.
 * No weighting, no anti-streak, no pity logic.
 */
// Lazy-cached Node.js crypto module for high-performance rejection sampling
let cachedNodeCrypto: { randomInt?: (min: number, max: number) => number } | null | undefined;
function getNodeCrypto() {
  if (cachedNodeCrypto === undefined) {
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedNodeCrypto = require('crypto');
      } catch {
        cachedNodeCrypto = null;
      }
    } else {
      cachedNodeCrypto = null;
    }
  }
  return cachedNodeCrypto;
}

export function rollFairDice(): number {
  // If Node.js crypto.randomInt is available (server environment)
  const nodeCrypto = getNodeCrypto();
  if (nodeCrypto && typeof nodeCrypto.randomInt === 'function') {
    // randomInt(min, max) returns uniform integer in [min, max) with rejection sampling
    return nodeCrypto.randomInt(1, 7);
  }

  // Web Crypto API (Browser & modern JS environments)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    // 32-bit rejection sampling to avoid modulo bias (4294967296 is not divisible by 6)
    // 4294967296 - (4294967296 % 6) = 4294967292
    const limit = 4294967292;
    const buf = new Uint32Array(1);
    while (true) {
      globalThis.crypto.getRandomValues(buf);
      const val = buf[0];
      if (val < limit) {
        return (val % 6) + 1;
      }
    }
  }

  // Fallback if neither crypto is available
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Rolls the dice for the active player.
 * Uses unbiased cryptographic rejection sampling by default,
 * or an injectable RNG function returning [0, 1) for tests.
 */
export function rollDice(
  state: GameState,
  rng?: RNG
): { state: GameState; roll: number; legalMoves: string[] } {
  if (
    (state.phase !== 'awaiting-roll' && state.phase !== 'need_roll') ||
    state.winner !== null
  ) {
    throw new Error(`Cannot roll dice during phase '${state.phase}'`);
  }

  const roll = rng ? Math.min(6, Math.max(1, Math.floor(rng() * 6) + 1)) : rollFairDice();

  const activePlayer = state.players[state.activePlayerIndex];
  const controllablePlayer = getControllablePlayer(state, activePlayer);

  // Consecutive sixes tracking
  const consecutiveSixes = roll === 6 ? state.consecutiveSixes + 1 : 0;

  // Rule: 3 consecutive sixes = FULL TURN REVERT
  // On the third consecutive 6: cancel everything, restore ALL token positions to turnStartSnapshot
  // (undoes the moves made with the first two sixes and any captures made during them).
  if (consecutiveSixes === 3 && state.rules.threeConsecutiveSixesLoss) {
    const snapshot = state.turnStartSnapshot || state.tokens;
    const shouldRevertCaptures = state.rules.revertCapturesOnThreeSixes !== false;

    const revertedTokens: RevertedTokenMove[] = [];
    const restoredTokenMap: Record<string, Token> = { ...state.tokens };

    for (const [id, currentToken] of Object.entries(state.tokens)) {
      const snapToken = snapshot[id];
      if (!snapToken) continue;

      const isControllable = controllablePlayer.tokenIds.includes(id);
      if (isControllable || shouldRevertCaptures) {
        if (currentToken.step !== snapToken.step) {
          revertedTokens.push({
            tokenId: id,
            fromStep: currentToken.step,
            toStep: snapToken.step,
          });
          restoredTokenMap[id] = { ...snapToken };
        }
      }
    }

    const nextRollSeq = (state.rollSeq || 0) + 1;
    const advanced = nextTurn({
      ...state,
      tokens: restoredTokenMap,
      diceValue: roll,
      currentRoll: roll,
      lastDiceRoll: roll,
      rollSeq: nextRollSeq,
      consecutiveSixes: 0,
      bonusRoll: null,
      legalMoves: [],
      revertedTurn: {
        turnCount: state.turnCount,
        playerColor: activePlayer.color,
        revertedTokens,
      },
      log: [
        ...state.log,
        `Three 6s rolled by ${activePlayer.name}! Turn cancelled and all moves reverted.`,
      ],
    });

    return {
      state: advanced,
      roll,
      legalMoves: [],
    };
  }

  // Calculate legal moves for this roll (each turn starts with exactly ONE roll)
  const legalMoves = getLegalMoves(state, roll);
  const nextRollSeq = (state.rollSeq || 0) + 1;

  if (legalMoves.length === 0) {
    // No legal moves possible with this roll.
    // Turn passes immediately to the next player.
    const advanced = nextTurn({
      ...state,
      diceValue: roll,
      currentRoll: roll,
      lastDiceRoll: roll,
      rollSeq: nextRollSeq,
      consecutiveSixes,
      bonusRoll: null,
      legalMoves: [],
      revertedTurn: null,
      log: [
        ...state.log,
        `${activePlayer.name} rolled a ${roll} with no legal moves. Turn passed.`,
      ],
    });
    return {
      state: advanced,
      roll,
      legalMoves: [],
    };
  }

  // Player has legal moves to choose from
  const nextState: GameState = {
    ...state,
    phase: 'awaiting-move',
    diceValue: roll,
    currentRoll: roll,
    lastDiceRoll: roll,
    rollSeq: nextRollSeq,
    consecutiveSixes,
    revertedTurn: null,
    legalMoves,
    log: [
      ...state.log,
      `${activePlayer.name} rolled a ${roll}.`,
    ],
  };

  return {
    state: nextState,
    roll,
    legalMoves,
  };
}

/**
 * Applies a move by moving the specified token.
 * Validates the move, handles token capture, checks victory conditions,
 * and passes the turn or awards a bonus roll accordingly.
 */
export function applyMove(state: GameState, tokenId: string): GameState {
  if (state.phase !== 'awaiting-move' && state.phase !== 'need_move') {
    throw new Error(`Cannot move during phase '${state.phase}'`);
  }

  const roll = state.diceValue ?? state.currentRoll;
  if (roll === null) {
    throw new Error('No active roll to apply move');
  }

  const token = state.tokens[tokenId];
  if (!token) {
    throw new Error(`Token '${tokenId}' not found`);
  }

  // Check if tokenId is directly in legalMoves OR is an equivalent choice
  // (e.g. user tapped another base token while base exit is legal, or another token on the same cell)
  const isDirectlyLegal = state.legalMoves.includes(tokenId);
  let isEquivalentLegal = false;

  if (!isDirectlyLegal) {
    for (const legalId of state.legalMoves) {
      const legalToken = state.tokens[legalId];
      if (legalToken && legalToken.color === token.color && legalToken.step === token.step) {
        isEquivalentLegal = true;
        break;
      }
    }
  }

  if (!isDirectlyLegal && !isEquivalentLegal) {
    throw new Error(`Token '${tokenId}' is not a legal move.`);
  }

  const activePlayer = state.players[state.activePlayerIndex];
  const fromStep = token.step;
  let toStep: number;
  const path: number[] = [];

  if (fromStep === STEP_BASE) {
    toStep = STEP_START;
    path.push(STEP_BASE, STEP_START);
  } else {
    toStep = Math.min(STEP_HOME_GOAL, fromStep + roll);
    for (let s = fromStep; s <= toStep; s++) {
      path.push(s);
    }
  }

  // Clone tokens map
  const updatedTokens: Record<string, Token> = {
    ...state.tokens,
    [tokenId]: {
      ...token,
      step: toStep,
    },
  };

  const capturedTokenIds: string[] = [];

  // Check capture if landing on shared track
  if (isOnTrack(toStep)) {
    const targetCell = stepToGlobalTrackIndex(token.color, toStep)!;
    const isSafe =
      (state.rules.starCellsAreSafe || state.rules.startCellsAreSafe) &&
      SAFE_CELLS_SET.has(targetCell);

    if (!isSafe) {
      // Find opponent tokens occupying targetCell
      const opponentTokensOnCell: Array<{ id: string; token: Token }> = [];

      for (const [otherId, otherToken] of Object.entries(updatedTokens)) {
        if (otherId === tokenId) continue;
        if (!isOnTrack(otherToken.step)) continue;

        const otherCell = stepToGlobalTrackIndex(otherToken.color, otherToken.step);
        if (otherCell !== targetCell) continue;

        // Check team relationship
        const otherPlayer = state.players.find((p) => p.color === otherToken.color);
        const isTeammate =
          state.mode === '2v2' &&
          activePlayer.team &&
          otherPlayer?.team === activePlayer.team;

        if (!isTeammate && otherToken.color !== token.color) {
          opponentTokensOnCell.push({ id: otherId, token: otherToken });
        }
      }

      // Check blockCannotBeCaptured rule:
      // If blockCannotBeCaptured is true, 2+ same-color opponent tokens form a block and cannot be captured
      let blockProtected = false;
      if (state.rules.blockCannotBeCaptured && opponentTokensOnCell.length >= 2) {
        const colorCounts = new Map<string, number>();
        for (const item of opponentTokensOnCell) {
          colorCounts.set(item.token.color, (colorCounts.get(item.token.color) || 0) + 1);
        }
        for (const count of colorCounts.values()) {
          if (count >= 2) {
            blockProtected = true;
            break;
          }
        }
      }

      if (!blockProtected) {
        for (const item of opponentTokensOnCell) {
          updatedTokens[item.id] = {
            ...item.token,
            step: STEP_BASE,
          };
          capturedTokenIds.push(item.id);
        }
      }
    }
  }

  const reachedHome = toStep === STEP_HOME_GOAL && fromStep < STEP_HOME_GOAL;

  // Check victory condition
  let winner: PlayerColor | TeamId | null = null;
  let winnerTeam: TeamId | null = null;

  if (state.mode === '1v1') {
    // Player wins if all 4 tokens are at STEP_HOME_GOAL
    const allHome = activePlayer.tokenIds.every(
      (id) => updatedTokens[id].step === STEP_HOME_GOAL
    );
    if (allHome) {
      winner = activePlayer.color;
    }
  } else {
    // 2v2: Team wins when all 8 tokens of both teammates are at STEP_HOME_GOAL
    const activeTeam = activePlayer.team!;
    const teamPlayers = state.players.filter((p) => p.team === activeTeam);
    const allTeamTokensHome = teamPlayers.every((p) =>
      p.tokenIds.every((id) => updatedTokens[id].step === STEP_HOME_GOAL)
    );
    if (allTeamTokensHome) {
      winner = activeTeam;
      winnerTeam = activeTeam;
    }
  }

  // Determine if active player receives a bonus roll
  const extraFromSix = roll === 6 && state.rules.sixGivesExtraTurn;
  const extraFromCapture = capturedTokenIds.length > 0 && state.rules.captureGivesExtraTurn;
  const extraFromHome = reachedHome && state.rules.homeFinishGivesExtraTurn;

  let bonusReason: BonusRollReason | null = null;
  if (extraFromCapture) {
    bonusReason = 'capture';
  } else if (extraFromHome) {
    bonusReason = 'home';
  } else if (extraFromSix) {
    bonusReason = 'six';
  }

  const getsExtraTurn = bonusReason !== null;

  const moveRecord: MoveRecord = {
    tokenId,
    playerColor: token.color,
    from: fromStep,
    to: toStep,
    fromStep,
    toStep,
    path,
    capturedTokenIds,
    reachedHome,
    awardedExtraTurn: getsExtraTurn,
    bonusReason,
    roll,
  };

  if (winner !== null) {
    return {
      ...state,
      tokens: updatedTokens,
      phase: 'game_over',
      diceValue: null,
      currentRoll: null,
      legalMoves: [],
      winner,
      winnerTeam,
      lastMove: moveRecord,
      bonusRoll: null,
      log: [
        ...state.log,
        `${activePlayer.name} wins the game!`,
      ],
    };
  }

  if (getsExtraTurn) {
    // Active player rolls again
    return {
      ...state,
      tokens: updatedTokens,
      phase: 'awaiting-roll',
      diceValue: null,
      currentRoll: null,
      legalMoves: [],
      lastMove: moveRecord,
      bonusRoll: {
        hasBonus: true,
        reason: bonusReason,
      },
      log: [
        ...state.log,
        `${activePlayer.name} moved token ${tokenId} and earned an extra roll (${bonusReason})!`,
      ],
    };
  }

  // No extra turn: proceed to next player's turn
  return nextTurn({
    ...state,
    tokens: updatedTokens,
    lastMove: moveRecord,
  });
}

/**
 * Passes turn to the next player.
 * Resets roll, attempt counter, and consecutive sixes counters.
 */
export function nextTurn(state: GameState): GameState {
  if (state.phase === 'game_over') {
    return state;
  }

  const nextIndex = (state.activePlayerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextIndex];

  return {
    ...state,
    activePlayerIndex: nextIndex,
    currentPlayer: nextPlayer.color,
    phase: 'awaiting-roll',
    diceValue: null,
    currentRoll: null,
    consecutiveSixes: 0,
    turnStartSnapshot: { ...state.tokens },
    bonusRoll: null,
    legalMoves: [],
    turnCount: state.turnCount + 1,
    log: [
      ...state.log,
      `Turn passed to ${nextPlayer.name} (${nextPlayer.color}).`,
    ],
  };
}
