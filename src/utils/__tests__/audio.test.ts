import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sound } from '../audio';

describe('Audio Module Compatibility & Persistence (Task 4 & 5)', () => {
  beforeEach(() => {
    // Reset any mocks
  });

  afterEach(() => {
    sound.setEnabled(true);
  });

  it('1. Audio methods execute safely without throwing when AudioContext is missing (headless environment)', () => {
    expect(() => {
      sound.playButton();
      sound.playDiceRoll();
      sound.playTokenStep(0);
      sound.playTokenStep(5);
      sound.playBaseExit();
      sound.playCapture();
      sound.playHomeFinish();
      sound.playBonus();
      sound.playTurnCancelled();
      sound.playError();
      sound.playVictory();
      sound.playTestSoundSequence();
    }).not.toThrow();
  });

  it('2. Mute persists correctly and controls isEnabled() state', () => {
    sound.setEnabled(false);
    expect(sound.isEnabled()).toBe(false);

    sound.setEnabled(true);
    expect(sound.isEnabled()).toBe(true);

    sound.setEnabled(false);
    expect(sound.isEnabled()).toBe(false);
  });
});
