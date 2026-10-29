/**
 * audio.ts
 *
 * Procedural Web Audio API sound synthesizer with zero external assets and zero network requests.
 * Fully compatible with iPhone Safari (audioSession / silent switch bypass) and Android Chrome.
 * Includes DynamicsCompressor and master gain to produce loud, punchy, distortion-free sound effects.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private soundEnabled: boolean = true; // Default ON
  private silentAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ludo_sound_enabled');
        this.soundEnabled = stored !== null ? stored === 'true' : true; // Default ON
      } catch {
        this.soundEnabled = true;
      }
      this.setupGestureUnlock();
    }
  }

  private setupGestureUnlock(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.initContext();
      this.unlockiOSAudioSession();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    window.addEventListener('touchend', unlock, { passive: true, capture: true });
    window.addEventListener('click', unlock, { passive: true, capture: true });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  private unlockiOSAudioSession(): void {
    try {
      // 1. If navigator.audioSession exists, set type to 'playback'
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        const navAudioSession = (navigator as unknown as { audioSession: { type: string } }).audioSession;
        if (navAudioSession && typeof navAudioSession === 'object') {
          navAudioSession.type = 'playback';
        }
      }

      // 2. Fallback: play silent looping HTMLAudioElement to switch to playback category on iOS Safari
      if (!this.silentAudio && typeof Audio !== 'undefined') {
        const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const audio = new Audio(silentWav);
        audio.loop = true;
        audio.volume = 0.01;
        audio.play().catch(() => {});
        this.silentAudio = audio;
      }
    } catch {
      // Graceful fallback
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();

        // DynamicsCompressor ensures loud punch without clipping or distortion
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(25, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

        // Master gain (default ~0.7 volume)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      return null;
    }

    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ludo_sound_enabled', enabled ? 'true' : 'false');
      } catch {
        // Ignore storage errors
      }
    }
  }

  private getDestinationNode(): AudioNode | null {
    if (!this.soundEnabled) return null;
    if (typeof document !== 'undefined' && document.hidden) return null;

    const ctx = this.initContext();
    if (!ctx) return null;

    return this.compressor || this.masterGain || ctx.destination;
  }

  /**
   * 1. UI Click: short soft pop/tick on every button press.
   */
  public playButton(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.022);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.028);
    } catch {
      // Never throw
    }
  }

  /**
   * 2. Dice Roll: bolder, richer rattle with band-pass filtered clicks,
  /**
   * 2. Dice Roll: a crisp, single, short (~220ms) procedural dice rattle and landing tap.
   */
  public playDiceRoll(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const ctx = this.ctx;

      // 3 rapid micro noise clicks across 80ms
      const clickDelays = [0, 0.035, 0.07];
      clickDelays.forEach((delay, idx) => {
        const clickTime = now + delay;
        const bufferSize = Math.floor(ctx.sampleRate * 0.01);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const bpf = ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.setValueAtTime(1600 + idx * 120, clickTime);
        bpf.Q.setValueAtTime(3.0, clickTime);

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.35, clickTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.012);

        noise.connect(bpf);
        bpf.connect(clickGain);
        clickGain.connect(dest);

        noise.start(clickTime);
        noise.stop(clickTime + 0.014);
      });

      // 1 resonant wooden tumble knock at 95ms
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now + 0.095);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.145);
      gain.gain.setValueAtTime(0.32, now + 0.095);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.145);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + 0.095);
      osc.stop(now + 0.15);

      // 1 firm low landing tap at 170ms
      const thumpTime = now + 0.17;
      const thumpOsc = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(135, thumpTime);
      thumpOsc.frequency.exponentialRampToValueAtTime(45, thumpTime + 0.05);
      thumpGain.gain.setValueAtTime(0.5, thumpTime);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, thumpTime + 0.06);
      thumpOsc.connect(thumpGain);
      thumpGain.connect(dest);
      thumpOsc.start(thumpTime);
      thumpOsc.stop(thumpTime + 0.07);
    } catch {
      // Never throw
    }
  }

  /**
   * 3. Token Move: a short wooden "tock" on EVERY cell step (synced to the hop).
   */
  public playTokenStep(stepIndex: number = 0): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const baseFreq = 540 + Math.min(260, stepIndex * 32);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.04);

      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Never throw
    }
  }

  /**
   * Token exit from base: a distinct buoyant "pop".
   */
  public playBaseExit(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.055);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.065);
    } catch {
      // Never throw
    }
  }

  /**
   * 4. Capture: punchy impact sound.
   */
  public playCapture(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const ctx = this.ctx;

      // Heavy low punch
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.21);

      // Noise impact burst
      const bufSize = Math.floor(ctx.sampleRate * 0.12);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.35, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(ng);
      ng.connect(dest);

      noise.start(now);
      noise.stop(now + 0.13);
    } catch {
      // Never throw
    }
  }

  /**
   * 5. Reaching the final home: short celebration (~1s) ascending 4-note chime with sparkle.
   */
  public playHomeFinish(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const notes = [783.99, 1046.5, 1318.5, 1567.98]; // G5, C6, E6, G6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const t = now + idx * 0.1;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.38, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + 0.38);
      });

      // Sparkle high chime at 0.42s
      const sparkTime = now + 0.42;
      const spark = this.ctx.createOscillator();
      const sparkGain = this.ctx.createGain();

      spark.type = 'sine';
      spark.frequency.setValueAtTime(2093, sparkTime); // C7

      sparkGain.gain.setValueAtTime(0.28, sparkTime);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, sparkTime + 0.45);

      spark.connect(sparkGain);
      sparkGain.connect(dest);

      spark.start(sparkTime);
      spark.stop(sparkTime + 0.48);
    } catch {
      // Never throw
    }
  }

  /**
   * Bonus roll: bright upward double chime.
   */
  public playBonus(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const t = now + i * 0.09;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch {
      // Never throw
    }
  }

  /**
   * Three 6s cancelled / error: distinct downward tone.
   */
  public playTurnCancelled(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.28);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Never throw
    }
  }

  public playError(): void {
    this.playTurnCancelled();
  }

  /**
   * Game win: grand fanfare celebration.
   */
  public playVictory(): void {
    const dest = this.getDestinationNode();
    if (!dest || !this.ctx) return;

    try {
      const chords = [
        { freq: 523.25, time: 0 },    // C5
        { freq: 659.25, time: 0.15 }, // E5
        { freq: 783.99, time: 0.3 },  // G5
        { freq: 1046.5, time: 0.45 }, // C6
        { freq: 1318.5, time: 0.65 }, // E6
        { freq: 1567.98, time: 0.8 }, // G6
      ];

      const now = this.ctx.currentTime;
      chords.forEach(({ freq, time }) => {
        const t = now + time;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + 0.6);
      });
    } catch {
      // Never throw
    }
  }

  /**
   * Plays test sequence for Settings modal: click -> dice rattle -> celebration.
   */
  public playTestSoundSequence(): void {
    this.playButton();
    setTimeout(() => {
      this.playDiceRoll();
    }, 250);
    setTimeout(() => {
      this.playHomeFinish();
    }, 900);
  }
}

export const sound = new SoundManager();
