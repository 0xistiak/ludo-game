import { describe, it, expect } from 'vitest';
import { generateRoomCode, sanitizeRoomCode } from '../roomCodes';

describe('Room Code Generation & Sanitization', () => {
  it('generates a 6-character room code by default', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('generates uppercase alphanumeric codes excluding ambiguous characters (0, O, 1, I)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(code).not.toContain('0');
      expect(code).not.toContain('O');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
    }
  });

  it('generates unique codes across calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(generateRoomCode());
    }
    // High entropy 32^6 ~ 1 billion permutations, 100 random codes should be distinct
    expect(set.size).toBe(100);
  });

  it('sanitizes input codes properly', () => {
    expect(sanitizeRoomCode(' abc-123 ')).toBe('ABC123');
    expect(sanitizeRoomCode('7k2-m9x!')).toBe('7K2M9X');
  });
});
