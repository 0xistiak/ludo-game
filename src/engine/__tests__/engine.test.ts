import { describe, it, expect } from 'vitest';
import {
  createGame,
  rollDice,
  getLegalMoves,
  applyMove,
  STEP_BASE,
  STEP_START,
  STEP_HOME_GOAL,
  GameState,
} from '../index';

// Deterministic mock RNG helper
function mockRNG(rollValue: number): () => number {
  // rollValue is 1..6. Math.floor(rng() * 6) + 1 === rollValue
  // So rng() = (rollValue - 0.5) / 6
  return () => (rollValue - 0.5) / 6;
}

describe('Ludo Game Engine', () => {
  it('1. Enter with six: token enters track on 6, cannot leave on 1-5', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Roll a 5: cannot leave base
    const roll5 = rollDice(game, mockRNG(5));
    // Since no tokens can move, turn is skipped to next player
    expect(roll5.roll).toBe(5);
    expect(roll5.legalMoves).toHaveLength(0);
    expect(roll5.state.activePlayerIndex).toBe(1); // Bob's turn now

    // Reset to Alice's turn to test roll 6
    const aliceGame = {
      ...game,
      activePlayerIndex: 0,
      phase: 'need_roll' as const,
    };
    const roll6 = rollDice(aliceGame, mockRNG(6));
    expect(roll6.roll).toBe(6);
    expect(roll6.legalMoves).toHaveLength(4); // All 4 tokens can enter
    expect(roll6.legalMoves).toContain('red_0');

    // Apply move to enter red_0
    const moved = applyMove(roll6.state, 'red_0');
    expect(moved.tokens['red_0'].step).toBe(STEP_START);
    // Rolling 6 gives extra turn by default
    expect(moved.activePlayerIndex).toBe(0);
    expect(moved.phase).toBe('need_roll');
  });

  it('2. Illegal moves: rejects invalid tokenId or illegal movement', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    const rolled = rollDice(game, mockRNG(6));
    // Cannot move opponent's token
    expect(() => applyMove(rolled.state, 'yellow_0')).toThrow();
    // Cannot move invalid token id
    expect(() => applyMove(rolled.state, 'invalid_id')).toThrow();

    // After applying move, cannot move again without rolling
    const moved = applyMove(rolled.state, 'red_0');
    expect(() => applyMove(moved, 'red_0')).toThrow();
  });

  it('3. Normal movement: advances token along track correctly', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Place red_0 on track at step 5
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 5 },
      },
    };

    const rolled = rollDice(state, mockRNG(3));
    expect(rolled.roll).toBe(3);
    expect(rolled.legalMoves).toContain('red_0');

    const moved = applyMove(rolled.state, 'red_0');
    expect(moved.tokens['red_0'].step).toBe(8); // 5 + 3
    // Normal roll passed turn to Bob
    expect(moved.activePlayerIndex).toBe(1);
  });

  it('4. Capture: landing on an opponent on an unsafe cell sends opponent to base', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Red start is 0. Yellow start is 26.
    // Red token at step 10 -> global track cell = (0 + 10) = 10 (not safe, 10 is not in SAFE_TRACK_CELLS)
    // Put yellow_0 on global track cell 14.
    // In yellow's perspective: START_CELLS.yellow is 26.
    // To be at global cell 14: (26 + step) % 52 = 14 => step = 40 (26 + 40 = 66 = 14 mod 52).
    // Cell 14 is NOT in safe cells.
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 10 },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 40 }, // cell 14
      },
    };

    // Red rolls a 4 -> lands on step 14 (cell 14)
    const rolled = rollDice(state, mockRNG(4));
    const moved = applyMove(rolled.state, 'red_0');

    expect(moved.tokens['red_0'].step).toBe(14);
    // Yellow token should be captured and returned to base (-1)
    expect(moved.tokens['yellow_0'].step).toBe(STEP_BASE);
    expect(moved.lastMove?.capturedTokenIds).toContain('yellow_0');
  });

  it('5. Safe cell: opponent cannot be captured on start or star cells', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Star cell 8 is a safe cell.
    // Red step 8 = cell 8.
    // Yellow at cell 8: (26 + step) % 52 = 8 => 26 + 34 = 60 = 8 mod 52 => step 34.
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 4 },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 34 }, // on cell 8
      },
    };

    // Red rolls 4 and lands on cell 8 (safe star cell)
    const rolled = rollDice(state, mockRNG(4));
    const moved = applyMove(rolled.state, 'red_0');

    expect(moved.tokens['red_0'].step).toBe(8);
    // Yellow must NOT be captured because cell 8 is safe
    expect(moved.tokens['yellow_0'].step).toBe(34);
    expect(moved.lastMove?.capturedTokenIds).toHaveLength(0);
  });

  it('6. Exact home finish: must roll exact value to finish in center home', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Token is at step 55 (needs exact 2 to reach STEP_HOME_GOAL 57)
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 55 },
      },
    };

    // Roll 3 (overshoot: 55 + 3 = 58 > 57): cannot move
    const roll3 = rollDice(state, mockRNG(3));
    expect(roll3.legalMoves).not.toContain('red_0');

    // Roll 2 (exact: 55 + 2 = 57): legal move and reaches goal
    const roll2 = rollDice(state, mockRNG(2));
    expect(roll2.legalMoves).toContain('red_0');

    const moved = applyMove(roll2.state, 'red_0');
    expect(moved.tokens['red_0'].step).toBe(STEP_HOME_GOAL);
    expect(moved.lastMove?.reachedHome).toBe(true);
  });

  it('7. Extra turn: rolling a 6 gives an extra turn to the same player', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    const rolled = rollDice(game, mockRNG(6));
    expect(rolled.roll).toBe(6);
    const moved = applyMove(rolled.state, 'red_0');

    // Still Alice's turn (index 0)
    expect(moved.activePlayerIndex).toBe(0);
    expect(moved.phase).toBe('need_roll');
  });

  it('8. Three-sixes rule: 3 consecutive sixes results in immediate turn forfeiture', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // State with 2 consecutive sixes already
    const stateWith2Sixes: GameState = {
      ...game,
      consecutiveSixes: 2,
    };

    // Roll a 3rd six
    const rollThirdSix = rollDice(stateWith2Sixes, mockRNG(6));
    expect(rollThirdSix.roll).toBe(6);
    // Turn lost! Consecutive sixes reset and turn passed to Bob (index 1)
    expect(rollThirdSix.legalMoves).toHaveLength(0);
    expect(rollThirdSix.state.activePlayerIndex).toBe(1);
    expect(rollThirdSix.state.consecutiveSixes).toBe(0);
    expect(rollThirdSix.state.phase).toBe('need_roll');
  });

  it('9. No-legal-move turn skip: skips turn immediately when no moves are possible', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // All Alice tokens are in base. Roll 4.
    const result = rollDice(game, mockRNG(4));
    expect(result.roll).toBe(4);
    expect(result.legalMoves).toHaveLength(0);
    // Active player is now Bob
    expect(result.state.activePlayerIndex).toBe(1);
    expect(result.state.phase).toBe('need_roll');
  });

  it('10. 1v1 win: all 4 tokens home triggers game over and blocks moves', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // 3 tokens already home, 4th at step 56 (needs 1 to finish)
    const stateNearWin: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: STEP_HOME_GOAL },
        red_1: { id: 'red_1', color: 'red', index: 1, step: STEP_HOME_GOAL },
        red_2: { id: 'red_2', color: 'red', index: 2, step: STEP_HOME_GOAL },
        red_3: { id: 'red_3', color: 'red', index: 3, step: 56 },
      },
    };

    const rolled = rollDice(stateNearWin, mockRNG(1));
    const finalState = applyMove(rolled.state, 'red_3');

    expect(finalState.tokens['red_3'].step).toBe(STEP_HOME_GOAL);
    expect(finalState.winner).toBe('red');
    expect(finalState.phase).toBe('game_over');

    // All further moves blocked
    expect(getLegalMoves(finalState)).toHaveLength(0);
    expect(() => rollDice(finalState)).toThrow();
  });

  it('11. 2v2 team win: both teammates must finish all 8 tokens, teammates do not capture each other', () => {
    const game = createGame({
      mode: '2v2',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Charlie', color: 'green' },
        { name: 'Dan', color: 'yellow' },
        { name: 'Eve', color: 'blue' },
      ],
    });

    // Team A: Red + Yellow
    // Team B: Green + Blue

    // Check teammate non-capture on unsafe cell:
    // Red token lands on Yellow token on non-safe cell
    // Red step 10 = cell 10.
    // Yellow at cell 10: step = 36 ((26 + 36) % 52 = 10). Cell 10 is not safe.
    const stateWithTeammates: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 6 },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 36 }, // at cell 10
      },
    };

    // Red rolls 4 -> lands on cell 10
    const roll4 = rollDice(stateWithTeammates, mockRNG(4));
    const moved = applyMove(roll4.state, 'red_0');

    expect(moved.tokens['red_0'].step).toBe(10);
    // Yellow token must NOT be captured because Red and Yellow are Team A partners
    expect(moved.tokens['yellow_0'].step).toBe(36);
    expect(moved.lastMove?.capturedTokenIds).toHaveLength(0);

    // Now test team win condition: all 8 tokens of Team A home
    const teamNearWin: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        // Red 4 tokens home
        red_0: { id: 'red_0', color: 'red', index: 0, step: STEP_HOME_GOAL },
        red_1: { id: 'red_1', color: 'red', index: 1, step: STEP_HOME_GOAL },
        red_2: { id: 'red_2', color: 'red', index: 2, step: STEP_HOME_GOAL },
        red_3: { id: 'red_3', color: 'red', index: 3, step: STEP_HOME_GOAL },
        // Yellow 3 tokens home, 1 token at step 56
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: STEP_HOME_GOAL },
        yellow_1: { id: 'yellow_1', color: 'yellow', index: 1, step: STEP_HOME_GOAL },
        yellow_2: { id: 'yellow_2', color: 'yellow', index: 2, step: STEP_HOME_GOAL },
        yellow_3: { id: 'yellow_3', color: 'yellow', index: 3, step: 56 },
      },
      activePlayerIndex: 2, // Yellow's turn
    };

    const yellowRoll = rollDice(teamNearWin, mockRNG(1));
    const yellowWon = applyMove(yellowRoll.state, 'yellow_3');

    expect(yellowWon.tokens['yellow_3'].step).toBe(STEP_HOME_GOAL);
    expect(yellowWon.winner).toBe('teamA');
    expect(yellowWon.winnerTeam).toBe('teamA');
    expect(yellowWon.phase).toBe('game_over');
  });
});
