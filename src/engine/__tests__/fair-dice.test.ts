import { describe, it, expect } from 'vitest';
import { rollFairDice, rollDice, createGame } from '../engine';

describe('Fair Dice Statistical & Correctness Tests (Task 2)', () => {
  it('1. Seeded / mock RNG test correctly maps fractions in [0, 1) to faces 1..6', () => {
    const game = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    const testFractions: Array<{ frac: number; expected: number }> = [
      { frac: 0.0, expected: 1 },
      { frac: 0.1, expected: 1 },
      { frac: 1 / 6 + 0.001, expected: 2 },
      { frac: 2 / 6 + 0.001, expected: 3 },
      { frac: 3 / 6 + 0.001, expected: 4 },
      { frac: 4 / 6 + 0.001, expected: 5 },
      { frac: 5 / 6 + 0.001, expected: 6 },
      { frac: 0.999999, expected: 6 },
    ];

    for (const { frac, expected } of testFractions) {
      const rolled = rollDice(game, () => frac);
      expect(rolled.roll).toBe(expected);
    }
  });

  it('2. Cryptographic fair dice: 60,000 rolls frequency is within 16.7% ± 1.5% for all faces', () => {
    const TOTAL_ROLLS = 60_000;
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    for (let i = 0; i < TOTAL_ROLLS; i++) {
      const face = rollFairDice();
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
      counts[face] = (counts[face] || 0) + 1;
    }

    // Expected frequency ~16.667%. ± 1.5% gives acceptable range: [15.167%, 18.167%]
    const minAcceptable = TOTAL_ROLLS * (0.16667 - 0.015); // ~9100
    const maxAcceptable = TOTAL_ROLLS * (0.16667 + 0.015); // ~10900

    for (let face = 1; face <= 6; face++) {
      const count = counts[face];
      const percentage = (count / TOTAL_ROLLS) * 100;
      expect(
        count,
        `Face ${face} frequency ${percentage.toFixed(2)}% (${count} rolls) should be between ${minAcceptable} and ${maxAcceptable}`
      ).toBeGreaterThanOrEqual(minAcceptable);
      expect(
        count,
        `Face ${face} frequency ${percentage.toFixed(2)}% (${count} rolls) should be between ${minAcceptable} and ${maxAcceptable}`
      ).toBeLessThanOrEqual(maxAcceptable);
    }
  }, 30000);
});
