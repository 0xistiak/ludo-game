/**
 * engine.ts
 *
 * Pure, deterministic Ludo game engine.
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
    phase: 'need_roll',
    currentRoll: null,
    consecutiveSixes: 0,
    tokens,
    legalMoves: [],
    winner: null,
    winnerTeam: null,
    lastMove: null,
    turnCount: 1,
    log: ['Game started'],
  };
}

/**
 * Returns the list of token IDs that can legally move given the current roll.
 */
export function getLegalMoves(state: GameState, rollOverride?: number): string[] {
  if (state.phase === 'game_over' || state.winner !== null) {
    return [];
  }

  const roll = rollOverride ?? state.currentRoll;
  if (roll === null || roll < 1 || roll > 6) {
    return [];
  }

  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer) return [];

  const legal: string[] = [];

  for (const tokenId of activePlayer.tokenIds) {
    const token = state.tokens[tokenId];
    if (!token) continue;

    // Token in base: needs 6 to enter start cell (if needSixToLeaveBase rule is enabled)
    if (token.step === STEP_BASE) {
      if (roll === 6 || !state.rules.needSixToLeaveBase) {
        legal.push(tokenId);
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
        legal.push(tokenId);
      }
      // If exact roll needed, this token cannot move
      continue;
    }

    // Target step <= STEP_HOME_GOAL: valid move
    legal.push(tokenId);
  }

  return legal;
}

/**
 * Rolls the dice for the active player.
 * Pure and deterministic; accepts an optional RNG function returning [0, 1).
 */
export function rollDice(
  state: GameState,
  rng: RNG = Math.random
): { state: GameState; roll: number; legalMoves: string[] } {
  if (state.phase !== 'need_roll' || state.winner !== null) {
    throw new Error(`Cannot roll dice during phase '${state.phase}'`);
  }

  const rawRoll = Math.floor(rng() * 6) + 1;
  const roll = Math.min(6, Math.max(1, rawRoll));

  const consecutiveSixes = roll === 6 ? state.consecutiveSixes + 1 : 0;
  const activePlayer = state.players[state.activePlayerIndex];

  // Rule: 3 consecutive sixes forfeits the turn immediately
  if (consecutiveSixes === 3 && state.rules.threeConsecutiveSixesLoss) {
    const advanced = nextTurn({
      ...state,
      currentRoll: roll,
      consecutiveSixes: 0,
      legalMoves: [],
      log: [
        ...state.log,
        `${activePlayer.name} rolled three 6s in a row! Turn forfeited.`,
      ],
    });
    return {
      state: advanced,
      roll,
      legalMoves: [],
    };
  }

  // Calculate legal moves for this roll
  const legalMoves = getLegalMoves(state, roll);

  if (legalMoves.length === 0) {
    // No legal moves possible with this roll.
    // Turn is skipped immediately to the next player.
    const advanced = nextTurn({
      ...state,
      currentRoll: roll,
      consecutiveSixes,
      legalMoves: [],
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
    phase: 'need_move',
    currentRoll: roll,
    consecutiveSixes,
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
 * and passes the turn or awards an extra turn accordingly.
 */
export function applyMove(state: GameState, tokenId: string): GameState {
  if (state.phase !== 'need_move') {
    throw new Error(`Cannot move during phase '${state.phase}'`);
  }

  if (!state.legalMoves.includes(tokenId)) {
    throw new Error(`Token '${tokenId}' is not a legal move.`);
  }

  const roll = state.currentRoll;
  if (roll === null) {
    throw new Error('No active roll to apply move');
  }

  const activePlayer = state.players[state.activePlayerIndex];
  const token = state.tokens[tokenId];
  if (!token) {
    throw new Error(`Token '${tokenId}' not found`);
  }

  const fromStep = token.step;
  let toStep: number;

  if (fromStep === STEP_BASE) {
    toStep = STEP_START;
  } else {
    toStep = Math.min(STEP_HOME_GOAL, fromStep + roll);
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
          // Opponent captured! Send back to base
          updatedTokens[otherId] = {
            ...otherToken,
            step: STEP_BASE,
          };
          capturedTokenIds.push(otherId);
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

  const moveRecord: MoveRecord = {
    tokenId,
    playerColor: token.color,
    fromStep,
    toStep,
    roll,
    capturedTokenIds,
    reachedHome,
    awardedExtraTurn: false,
  };

  if (winner !== null) {
    return {
      ...state,
      tokens: updatedTokens,
      phase: 'game_over',
      currentRoll: null,
      legalMoves: [],
      winner,
      winnerTeam,
      lastMove: moveRecord,
      log: [
        ...state.log,
        `${activePlayer.name} wins the game!`,
      ],
    };
  }

  // Determine if active player receives an extra turn
  const extraFromSix = roll === 6 && state.rules.sixGivesExtraTurn;
  const extraFromCapture = capturedTokenIds.length > 0 && state.rules.captureGivesExtraTurn;
  const extraFromHome = reachedHome && state.rules.homeFinishGivesExtraTurn;

  const getsExtraTurn = extraFromSix || extraFromCapture || extraFromHome;
  moveRecord.awardedExtraTurn = getsExtraTurn;

  if (getsExtraTurn) {
    // Active player rolls again
    return {
      ...state,
      tokens: updatedTokens,
      phase: 'need_roll',
      currentRoll: null,
      legalMoves: [],
      lastMove: moveRecord,
      log: [
        ...state.log,
        `${activePlayer.name} moved token ${tokenId} and earned an extra roll!`,
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
 * Resets roll and consecutive sixes counters.
 */
export function nextTurn(state: GameState): GameState {
  if (state.phase === 'game_over') {
    return state;
  }

  const nextIndex = (state.activePlayerIndex + 1) % state.players.length;

  // In 2v2, if a player's all 4 tokens are already home, check if game is still going
  // If their partner still has tokens, turn passes normally so they can either pass or partner plays
  const nextPlayer = state.players[nextIndex];

  return {
    ...state,
    activePlayerIndex: nextIndex,
    phase: 'need_roll',
    currentRoll: null,
    consecutiveSixes: 0,
    legalMoves: [],
    turnCount: state.turnCount + 1,
    log: [
      ...state.log,
      `Turn passed to ${nextPlayer.name} (${nextPlayer.color}).`,
    ],
  };
}
