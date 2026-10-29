import { describe, it, expect } from 'vitest';
import { generateRoomCode, sanitizeRoomCode } from '../roomCodes';

describe('Room Code Generation & Sanitization', () => {
  it('generates a 6-character room code by default', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('generates 6-digit numeric codes with digits from 1 to 6', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[1-6]{6}$/);
    }
  });

  it('generates high entropy codes across calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generateRoomCode());
    }
    // Out of 50 samples from 46,656 permutations, at least 45 unique codes
    expect(set.size).toBeGreaterThanOrEqual(45);
  });

  it('sanitizes input codes properly', () => {
    expect(sanitizeRoomCode(' abc-123 ')).toBe('ABC123');
    expect(sanitizeRoomCode('7k2-m9x!')).toBe('7K2M9X');
  });
});
