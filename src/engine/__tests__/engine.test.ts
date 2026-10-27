import { describe, it, expect } from 'vitest';
import {
  createGame,
  rollDice,
  getLegalMoves,
  getAutoMove,
  applyMove,
  STEP_BASE,
  STEP_START,
  STEP_HOME_GOAL,
  GameState,
} from '../index';

// Deterministic mock RNG helper
function mockRNG(rollValue: number): () => number {
  return () => (rollValue - 0.5) / 6;
}

describe('Classic Ludo Game Engine (Rules & Auto-Move)', () => {
  it('1. Token leaves base only on 6 and goes to its start cell', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Test getLegalMoves directly
    const candidateMoves = getLegalMoves(game, 6);
    expect(candidateMoves).toEqual(['red_0']);

    // Roll a 6 on first attempt
    const roll6 = rollDice(game, mockRNG(6));
    expect(roll6.roll).toBe(6);
    expect(roll6.legalMoves).toHaveLength(1); // De-duplicated: all base tokens count as 1 choice
    expect(roll6.legalMoves[0]).toBe('red_0');

    // Apply move to bring token to start cell
    const moved = applyMove(roll6.state, 'red_0');
    expect(moved.tokens['red_0'].step).toBe(STEP_START);
    // Rolling 6 awards an extra roll
    expect(moved.bonusRoll?.hasBonus).toBe(true);
    expect(moved.bonusRoll?.reason).toBe('six');
    expect(moved.activePlayerIndex).toBe(0);
  });

  it('2. Rolling a 6 allows choosing EITHER base exit OR moving a token on track', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Place red_0 on track at step 10, remaining 3 in base
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 10 },
      },
    };

    const rolled = rollDice(state, mockRNG(6));
    expect(rolled.roll).toBe(6);
    // Two distinct legal choices: red_0 on track (10 -> 16), or base exit
    expect(rolled.legalMoves).toHaveLength(2);
    expect(rolled.legalMoves).toContain('red_0');
    expect(rolled.legalMoves).toContain('red_1'); // Representative for remaining base tokens

    // getAutoMove returns null because 2 choices exist
    expect(getAutoMove(rolled.state)).toBeNull();

    // Option A: Advance track token
    const movedTrack = applyMove(rolled.state, 'red_0');
    expect(movedTrack.tokens['red_0'].step).toBe(16);

    // Option B: Bring new token out of base
    const movedBase = applyMove(rolled.state, 'red_1');
    expect(movedBase.tokens['red_1'].step).toBe(STEP_START);
  });

  it('3. One roll per turn: when all tokens in base and roll is not 6, turn passes immediately without 3 attempts', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Alice starts. Exactly 1 roll.
    // Alice rolls a 4 (fails to bring token out of base)
    const try1 = rollDice(game, mockRNG(4));
    expect(try1.roll).toBe(4);
    expect(try1.legalMoves).toHaveLength(0);
    // Turn passes immediately to Bob on non-6 with no legal moves
    expect(try1.state.activePlayerIndex).toBe(1);
    expect(try1.state.currentPlayer).toBe('yellow');
    expect(try1.state.phase).toBe('awaiting-roll');
    // Ensure rollAttempts state property is completely removed
    expect((try1.state as unknown as Record<string, unknown>).rollAttempts).toBeUndefined();
  });

  it('4. Roll of 1-5 allows freely moving ANY legal outside token (choice when 2+ outside)', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Alice has two tokens outside: red_0 at step 5 and red_1 at step 10
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 5 },
        red_1: { id: 'red_1', color: 'red', index: 1, step: 10 },
      },
    };

    // Roll 3: both red_0 and red_1 are legal choices
    const rolled = rollDice(state, mockRNG(3));
    expect(rolled.roll).toBe(3);
    expect(rolled.legalMoves).toHaveLength(2);
    expect(rolled.legalMoves).toContain('red_0');
    expect(rolled.legalMoves).toContain('red_1');

    // Auto-move MUST return null when 2+ distinct choices exist
    expect(getAutoMove(rolled.state)).toBeNull();

    // Player freely chooses to move red_1 instead of red_0
    const moved = applyMove(rolled.state, 'red_1');
    expect(moved.tokens['red_1'].step).toBe(13);
    expect(moved.tokens['red_0'].step).toBe(5); // red_0 untouched
    expect(moved.activePlayerIndex).toBe(1); // Normal turn pass
  });

  it('5. Three consecutive sixes: full turn revert (all token moves and captures undone) and turn passes', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Setup:
    // Red starts with red_0 at step 0 (start cell).
    // Bob has yellow_0 at global track 6 (Yellow start is 26, so step 32 = (26 + 32) % 52 = 6).
    const startTokens = {
      ...game.tokens,
      red_0: { id: 'red_0', color: 'red' as const, index: 0, step: 0 },
      yellow_0: { id: 'yellow_0', color: 'yellow' as const, index: 0, step: 32 },
    };

    const stateAtTurnStart: GameState = {
      ...game,
      tokens: startTokens,
      turnStartSnapshot: { ...startTokens },
      consecutiveSixes: 0,
      activePlayerIndex: 0,
    };

    // 1st Roll: 6
    const roll1 = rollDice(stateAtTurnStart, mockRNG(6));
    expect(roll1.state.consecutiveSixes).toBe(1);
    // Move red_0 from 0 -> 6, capturing yellow_0!
    const move1 = applyMove(roll1.state, 'red_0');
    expect(move1.tokens['red_0'].step).toBe(6);
    expect(move1.tokens['yellow_0'].step).toBe(STEP_BASE); // captured to base!
    expect(move1.bonusRoll?.hasBonus).toBe(true);

    // 2nd Roll: 6
    const roll2 = rollDice(move1, mockRNG(6));
    expect(roll2.state.consecutiveSixes).toBe(2);
    // Move red_0 from 6 -> 12
    const move2 = applyMove(roll2.state, 'red_0');
    expect(move2.tokens['red_0'].step).toBe(12);
    expect(move2.bonusRoll?.hasBonus).toBe(true);

    // 3rd Roll: 6 -> triggers THREE SIXES FULL REVERT!
    const roll3 = rollDice(move2, mockRNG(6));
    expect(roll3.roll).toBe(6);
    expect(roll3.legalMoves).toHaveLength(0);
    expect(roll3.state.consecutiveSixes).toBe(0);
    expect(roll3.state.bonusRoll).toBeNull();
    expect(roll3.state.activePlayerIndex).toBe(1); // Turn passed to Bob!

    // ALL token positions must be restored to turnStartSnapshot
    expect(roll3.state.tokens['red_0'].step).toBe(0); // red_0 restored to step 0!
    expect(roll3.state.tokens['yellow_0'].step).toBe(32); // yellow_0 returned from base back to step 32!

    // Check revertedTurn metadata
    expect(roll3.state.revertedTurn).not.toBeNull();
    expect(roll3.state.revertedTurn?.playerColor).toBe('red');
    expect(roll3.state.revertedTurn?.revertedTokens.length).toBeGreaterThan(0);
  });

  it('5B. Normal 6, 6, then non-6 keeps all moves made during the turn', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    const stateAtTurnStart: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 0 },
      },
      turnStartSnapshot: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 0 },
      },
    };

    // 1st Roll: 6 -> move red_0 from 0 -> 6
    const roll1 = rollDice(stateAtTurnStart, mockRNG(6));
    const move1 = applyMove(roll1.state, 'red_0');

    // 2nd Roll: 6 -> move red_0 from 6 -> 12
    const roll2 = rollDice(move1, mockRNG(6));
    const move2 = applyMove(roll2.state, 'red_0');

    // 3rd Roll: 3 (non-6) -> move red_0 from 12 -> 15
    const roll3 = rollDice(move2, mockRNG(3));
    expect(roll3.state.consecutiveSixes).toBe(0); // Non-6 resets counter
    const move3 = applyMove(roll3.state, 'red_0');

    // Turn ends normally without revert!
    expect(move3.tokens['red_0'].step).toBe(15);
    expect(move3.activePlayerIndex).toBe(1); // Turn passed to Bob
    expect(move3.revertedTurn).toBeNull();
  });

  it('5C. Bonus roll from capture/home does not reset consecutive-six counter unless a non-6 is rolled', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Setup:
    // red_0 at step 0
    // yellow_0 at global cell 6 (step 32)
    const startTokens = {
      ...game.tokens,
      red_0: { id: 'red_0', color: 'red' as const, index: 0, step: 0 },
      yellow_0: { id: 'yellow_0', color: 'yellow' as const, index: 0, step: 32 },
    };

    const state: GameState = {
      ...game,
      tokens: startTokens,
      turnStartSnapshot: { ...startTokens },
    };

    // 1st Roll: 6
    const roll1 = rollDice(state, mockRNG(6));
    expect(roll1.state.consecutiveSixes).toBe(1);
    const move1 = applyMove(roll1.state, 'red_0'); // lands at 6, captures yellow_0
    expect(move1.bonusRoll?.reason).toBe('capture'); // Bonus awarded from capture!

    // 2nd Roll: 6 again! (consecutiveSixes continues counting: 1 -> 2)
    const roll2 = rollDice(move1, mockRNG(6));
    expect(roll2.state.consecutiveSixes).toBe(2);
    const move2 = applyMove(roll2.state, 'red_0');

    // 3rd Roll: 6 again! (consecutiveSixes reaches 3 -> triggers revert)
    const roll3 = rollDice(move2, mockRNG(6));
    expect(roll3.state.consecutiveSixes).toBe(0);
    expect(roll3.state.activePlayerIndex).toBe(1); // Turn passed!
    expect(roll3.state.tokens['red_0'].step).toBe(0); // Reverted!
    expect(roll3.state.tokens['yellow_0'].step).toBe(32); // Reverted!
  });

  it('6. Capturing an opponent token gives bonus roll with reason "capture"', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Red on track at step 5; Yellow on track at step 8
    // Red start cell is 0; Yellow start cell is 26.
    // Red step 8 = global track cell (0 + 8) % 52 = 8 (star cell).
    // Let's use cell 7 (non-safe cell) for capture!
    // Red step 7 = global track 7.
    // Bob (yellow): START_CELLS.yellow is 26.
    // To be on global cell 7: (26 + step) % 52 === 7 => step = 33.
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 4 },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 33 }, // global cell 7
      },
    };

    // Red rolls 3: step 4 + 3 = step 7 (global track 7)
    const rolled = rollDice(state, mockRNG(3));
    expect(rolled.legalMoves).toContain('red_0');

    const moved = applyMove(rolled.state, 'red_0');
    expect(moved.tokens['red_0'].step).toBe(7);
    expect(moved.tokens['yellow_0'].step).toBe(STEP_BASE); // Yellow captured!
    expect(moved.lastMove?.capturedTokenIds).toContain('yellow_0');
    expect(moved.bonusRoll?.hasBonus).toBe(true);
    expect(moved.bonusRoll?.reason).toBe('capture');
    expect(moved.activePlayerIndex).toBe(0); // Alice rolls again!
  });

  it('7. Reaching center home gives bonus roll with reason "home"', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Red token at step 55 (needs 2 to reach STEP_HOME_GOAL 57)
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 55 },
      },
    };

    const rolled = rollDice(state, mockRNG(2));
    expect(rolled.legalMoves).toContain('red_0');

    const moved = applyMove(rolled.state, 'red_0');
    expect(moved.tokens['red_0'].step).toBe(STEP_HOME_GOAL);
    expect(moved.lastMove?.reachedHome).toBe(true);
    expect(moved.bonusRoll?.hasBonus).toBe(true);
    expect(moved.bonusRoll?.reason).toBe('home');
    expect(moved.activePlayerIndex).toBe(0); // Alice rolls again!
  });

  it('8. Exact roll required to reach home: overshoots cannot move', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Token at step 55: needs exact 2 to finish. Rolling 3, 4, 5, 6 is an overshoot!
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 55 },
      },
    };

    const rolled3 = rollDice(state, mockRNG(3));
    // Overshoots cannot move! With no other tokens movable, turn passes to Bob
    expect(rolled3.legalMoves).toHaveLength(0);
    expect(rolled3.state.activePlayerIndex).toBe(1);
  });

  it('9. Safe cells protect tokens from capture (Start cells + Star cells)', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Step 8 is a star cell (STAR_CELLS = [8, 21, 34, 47])
    // Red moves to step 8; Yellow is also at global cell 8 (step 34 for yellow)
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 4 },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 34 }, // global cell 8
      },
    };

    const rolled = rollDice(state, mockRNG(4)); // 4 + 4 = 8 (star cell)
    const moved = applyMove(rolled.state, 'red_0');

    expect(moved.tokens['red_0'].step).toBe(8);
    // Yellow is on a safe star cell -> NOT captured!
    expect(moved.tokens['yellow_0'].step).toBe(34);
    expect(moved.lastMove?.capturedTokenIds).toHaveLength(0);
  });

  it('10. Equivalent-move de-duplication: all base tokens = 1 choice; same-cell tokens = 1 choice', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Case A: 4 tokens in base on roll 6 -> de-duplicates to 1 choice
    const roll6Base = rollDice(game, mockRNG(6));
    expect(roll6Base.legalMoves).toHaveLength(1);
    expect(roll6Base.legalMoves[0]).toBe('red_0');
    // Tapping another base token is equivalent and allowed
    const movedRed1 = applyMove(roll6Base.state, 'red_1');
    expect(movedRed1.tokens['red_1'].step).toBe(STEP_START);

    // Case B: Two tokens on the exact same cell on track
    const stateStacked: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 15 },
        red_1: { id: 'red_1', color: 'red', index: 1, step: 15 }, // same cell
      },
    };

    const rolled4 = rollDice(stateStacked, mockRNG(4));
    // Moving red_0 or red_1 is identical -> de-duplicates to 1 choice!
    expect(rolled4.legalMoves).toHaveLength(1);
    expect(getAutoMove(rolled4.state)).toBe('red_0');

    // Tapping either equivalent token succeeds
    const movedStacked = applyMove(rolled4.state, 'red_1');
    expect(movedStacked.tokens['red_1'].step).toBe(19);
  });

  it('11. getAutoMove returns single legal move, null when multiple choices exist', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    // Only 1 token on board (step 5), rest in base. Rolled 3.
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 5 },
      },
    };

    const rolled = rollDice(state, mockRNG(3));
    expect(rolled.legalMoves).toEqual(['red_0']);
    expect(getAutoMove(rolled.state)).toBe('red_0');
  });

  it('12. 2v2: teammates never capture each other', () => {
    const game = createGame({
      mode: '2v2',
      players: [
        { name: 'Red Player', color: 'red' },
        { name: 'Green Player', color: 'green' },
        { name: 'Yellow Player', color: 'yellow' },
        { name: 'Blue Player', color: 'blue' },
      ],
    });

    // Red (teamA) and Yellow (teamA) are teammates!
    // Red step 7 lands on Yellow global cell 7
    const state: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 3 },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 33 }, // global cell 7
      },
    };

    const rolled = rollDice(state, mockRNG(4)); // 3 + 4 = 7
    const moved = applyMove(rolled.state, 'red_0');

    expect(moved.tokens['red_0'].step).toBe(7);
    // Teammate Yellow is NOT captured
    expect(moved.tokens['yellow_0'].step).toBe(33);
    expect(moved.lastMove?.capturedTokenIds).toHaveLength(0);
  });

  it('13. 2v2: when a player finishes all 4 tokens, they roll and move their teammate\'s tokens', () => {
    const game = createGame({
      mode: '2v2',
      players: [
        { name: 'Red Player', color: 'red' },
        { name: 'Green Player', color: 'green' },
        { name: 'Yellow Player', color: 'yellow' },
        { name: 'Blue Player', color: 'blue' },
      ],
    });

    // Red has finished ALL 4 tokens! Yellow has 1 token on track at step 10
    const state: GameState = {
      ...game,
      activePlayerIndex: 0, // Red's turn
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: STEP_HOME_GOAL },
        red_1: { id: 'red_1', color: 'red', index: 1, step: STEP_HOME_GOAL },
        red_2: { id: 'red_2', color: 'red', index: 2, step: STEP_HOME_GOAL },
        red_3: { id: 'red_3', color: 'red', index: 3, step: STEP_HOME_GOAL },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 10 },
      },
    };

    // Red rolls a 4
    const rolled = rollDice(state, mockRNG(4));
    // Red controls teammate Yellow's tokens!
    expect(rolled.legalMoves).toContain('yellow_0');

    // Red applies move for teammate's token
    const moved = applyMove(rolled.state, 'yellow_0');
    expect(moved.tokens['yellow_0'].step).toBe(14);
  });

  it('14. blockCannotBeCaptured config flag behavior', () => {
    // Config: blockCannotBeCaptured = true
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
      rules: {
        blockCannotBeCaptured: true,
      },
    });

    // Yellow has 2 tokens stacked on global cell 7 (non-safe cell)
    const stateBlocked: GameState = {
      ...game,
      tokens: {
        ...game.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: 3 },
        yellow_0: { id: 'yellow_0', color: 'yellow', index: 0, step: 33 }, // global cell 7
        yellow_1: { id: 'yellow_1', color: 'yellow', index: 1, step: 33 }, // global cell 7
      },
    };

    const rolled = rollDice(stateBlocked, mockRNG(4)); // Red moves 3 + 4 = 7
    const moved = applyMove(rolled.state, 'red_0');

    // Block protected -> Yellow tokens are NOT captured
    expect(moved.tokens['red_0'].step).toBe(7);
    expect(moved.tokens['yellow_0'].step).toBe(33);
    expect(moved.tokens['yellow_1'].step).toBe(33);
    expect(moved.lastMove?.capturedTokenIds).toHaveLength(0);
  });

  it('15. Victory conditions: 1v1 triggers on 4 tokens; 2v2 triggers on all 8 team tokens', () => {
    // 1v1: 4 tokens home
    const game1v1 = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    const stateNearWin: GameState = {
      ...game1v1,
      tokens: {
        ...game1v1.tokens,
        red_0: { id: 'red_0', color: 'red', index: 0, step: STEP_HOME_GOAL },
        red_1: { id: 'red_1', color: 'red', index: 1, step: STEP_HOME_GOAL },
        red_2: { id: 'red_2', color: 'red', index: 2, step: STEP_HOME_GOAL },
        red_3: { id: 'red_3', color: 'red', index: 3, step: 56 }, // Needs 1 to win
      },
    };

    const rolled = rollDice(stateNearWin, mockRNG(1));
    const wonState = applyMove(rolled.state, 'red_3');
    expect(wonState.phase).toBe('game_over');
    expect(wonState.winner).toBe('red');

    // Actions blocked after game over
    expect(() => rollDice(wonState)).toThrow();
  });
});
