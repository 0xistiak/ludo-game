/**
 * Dice3D.tsx
 *
 * 3D-styled ivory dice with:
 * - IDLE STATE: Plain white dice displaying the PlayWebLudo logo (no pips, no default 6)
 * - ROLLING STATE: Smooth ~600ms decelerating random-face tumble ending on the real roll
 * - RESULT STATE: Real number pips shown until move is finished, then returns to IDLE logo
 * - Glowing pod with active color ring and sound effect trigger
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { PlayerColor } from '@/engine';
import { sound } from '@/utils/audio';

interface Dice3DProps {
  currentRoll: number | null;
  lastRoll?: number | null;
  canRoll: boolean;
  activeColor: PlayerColor;
  onRoll: () => void;
  disabled?: boolean;
  bonusReason?: 'six' | 'capture' | 'home' | null;
  rollId?: string | number | null;
  isMyTurn?: boolean;
}

export const Dice3D: React.FC<Dice3DProps> = ({
  currentRoll,
  lastRoll,
  canRoll,
  activeColor,
  onRoll,
  disabled = false,
  bonusReason,
  rollId,
  isMyTurn = true,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [tumblingFace, setTumblingFace] = useState<number>(1);
  const [persistedRoll, setPersistedRoll] = useState<number | null>(null);
  const isFirstMountRef = useRef(true);
  const lastHandledRollIdRef = useRef<string | number | null>(null);
  const currentRollRef = useRef<number | null>(currentRoll);
  const lastRollRef = useRef<number | null>(lastRoll ?? currentRoll ?? null);

  useEffect(() => {
    currentRollRef.current = currentRoll;
    if (currentRoll !== null) {
      lastRollRef.current = currentRoll;
    }
  }, [currentRoll]);

  useEffect(() => {
    if (lastRoll !== undefined && lastRoll !== null) {
      lastRollRef.current = lastRoll;
    }
  }, [lastRoll]);

  // Keep displayed face visible for ~1400ms after currentRoll goes null so opponent and roller can read the number
  useEffect(() => {
    if (currentRoll === null && persistedRoll !== null && !isRolling) {
      const timer = setTimeout(() => {
        setPersistedRoll(null);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [currentRoll, persistedRoll, isRolling]);

  // Hard safety timeout: isRolling must NEVER remain true longer than 750ms under any circumstances
  useEffect(() => {
    if (isRolling) {
      const timer = setTimeout(() => {
        setIsRolling(false);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [isRolling]);

  // Run the smooth ~540ms decelerating random tumble sequence
  const startTumble = useCallback((onComplete?: () => void) => {
    setIsRolling(true);
    sound.playDiceRoll();

    const delays = [35, 40, 45, 55, 70, 85, 100, 110];
    let step = 0;
    let timer: NodeJS.Timeout | null = null;

    const tick = () => {
      setTumblingFace((prev) => {
        let nextFace = Math.floor(Math.random() * 6) + 1;
        while (nextFace === prev) {
          nextFace = Math.floor(Math.random() * 6) + 1;
        }
        return nextFace;
      });

      step++;
      if (step < delays.length) {
        timer = setTimeout(tick, delays[step]);
      } else {
        // Tumble sequence complete (~540ms total)
        setIsRolling(false);
        const resolvedFace = currentRollRef.current ?? lastRollRef.current ?? 1;
        setPersistedRoll(resolvedFace);
        onComplete?.();
      }
    };

    timer = setTimeout(tick, delays[0]);

    return () => {
      if (timer) clearTimeout(timer);
      setIsRolling(false);
    };
  }, []);

  // Trigger roll animation for opponent rolls when roll arrives from server
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      lastHandledRollIdRef.current = rollId ?? null;
      return;
    }

    if (!rollId || rollId === lastHandledRollIdRef.current) {
      return;
    }

    // Record that we saw this rollId immediately so it is never re-processed
    lastHandledRollIdRef.current = rollId;

    // If it's my turn, handleRollClick triggered the roll animation already
    if (isMyTurn) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const resolved = currentRollRef.current ?? lastRollRef.current ?? null;
      if (resolved) {
        setPersistedRoll(resolved);
      }
      return;
    }

    // Opponent's roll arrived: tumble asynchronously then display result
    let cleanupFn: (() => void) | undefined;
    const startTimer = setTimeout(() => {
      cleanupFn = startTumble();
    }, 0);

    return () => {
      clearTimeout(startTimer);
      cleanupFn?.();
      setIsRolling(false);
    };
  }, [rollId, isMyTurn, startTumble]);

  const handleRollClick = () => {
    if (isRolling) {
      setIsRolling(false);
    }
    if (rollId) {
      lastHandledRollIdRef.current = rollId;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !canRoll) {
      onRoll();
      return;
    }

    // Call onRoll immediately so server request starts in parallel with animation
    onRoll();
    startTumble();
  };

  const activeFace = isRolling ? tumblingFace : (currentRoll ?? persistedRoll);

  const ringGlows: Record<PlayerColor, string> = {
    red: 'rgba(239, 68, 68, 0.65)',
    green: 'rgba(34, 197, 94, 0.65)',
    yellow: 'rgba(250, 204, 21, 0.65)',
    blue: 'rgba(59, 130, 246, 0.65)',
  };

  // Render pips for face 1..6
  const renderPips = (num: number) => {
    const pips: Record<number, Array<{ cx: number; cy: number }>> = {
      1: [{ cx: 50, cy: 50 }],
      2: [
        { cx: 30, cy: 30 },
        { cx: 70, cy: 70 },
      ],
      3: [
        { cx: 30, cy: 30 },
        { cx: 50, cy: 50 },
        { cx: 70, cy: 70 },
      ],
      4: [
        { cx: 30, cy: 30 },
        { cx: 70, cy: 30 },
        { cx: 30, cy: 70 },
        { cx: 70, cy: 70 },
      ],
      5: [
        { cx: 30, cy: 30 },
        { cx: 70, cy: 30 },
        { cx: 50, cy: 50 },
        { cx: 30, cy: 70 },
        { cx: 70, cy: 70 },
      ],
      6: [
        { cx: 30, cy: 26 },
        { cx: 70, cy: 26 },
        { cx: 30, cy: 50 },
        { cx: 70, cy: 50 },
        { cx: 30, cy: 74 },
        { cx: 70, cy: 74 },
      ],
    };

    const coords = pips[num] || pips[1];
    return coords.map((c, i) => (
      <g key={i} className="dice-pip">
        {/* Recessed pip shadow */}
        <circle cx={c.cx} cy={c.cy + 0.8} r="6.5" fill="#475569" opacity="0.4" />
        {/* Pip dark center */}
        <circle cx={c.cx} cy={c.cy} r="6" fill="#0F172A" />
        {/* Inner specular pip shine */}
        <circle cx={c.cx - 1.5} cy={c.cy - 1.5} r="1.5" fill="#334155" opacity="0.6" />
      </g>
    ));
  };

  const glowColor = ringGlows[activeColor] || ringGlows.red;

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Outer Pod Glowing Ring */}
      <button
        id="dice-roll-button"
        type="button"
        onClick={handleRollClick}
        disabled={isRolling && !isMyTurn}
        aria-label="Roll Dice"
        className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-200 select-none ${
          canRoll && !disabled
            ? 'scale-100 hover:scale-105 active:scale-95 cursor-pointer'
            : isMyTurn
            ? 'scale-100 hover:scale-105 active:scale-95 cursor-pointer opacity-90'
            : 'opacity-70 cursor-pointer'
        }`}
        style={{
          background: `radial-gradient(circle, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 70%)`,
          boxShadow:
            canRoll && !disabled
              ? `0 0 25px ${glowColor}, inset 0 0 15px ${glowColor}`
              : isMyTurn
              ? `0 0 15px ${glowColor}`
              : '0 4px 15px rgba(0, 0, 0, 0.4)',
          border: `3px solid ${
            canRoll && !disabled
              ? glowColor
              : isMyTurn
              ? glowColor
              : 'rgba(255, 255, 255, 0.1)'
          }`,
        }}
      >
        {/* 3D Dice SVG with pure clean 600ms tumble animation */}
        <div
          id="dice-cube"
          className={`w-14 h-14 sm:w-16 sm:h-16 relative flex items-center justify-center ${isRolling ? 'dice-tumbling' : ''}`}
          style={{
            transform: 'none',
            transition: 'none',
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
            <defs>
              <linearGradient id="dice-top-bevel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="40%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#CBD5E1" />
              </linearGradient>
              <linearGradient id="dice-edge-shade" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* Dice rounded cube body */}
            <rect
              x="6"
              y="6"
              width="88"
              height="88"
              rx="18"
              fill="url(#dice-top-bevel)"
              stroke="#CBD5E1"
              strokeWidth="2"
            />

            {/* Inner highlight bevel */}
            <rect
              x="10"
              y="10"
              width="80"
              height="80"
              rx="14"
              fill="none"
              stroke="url(#dice-edge-shade)"
              strokeWidth="1.5"
            />

            {/* Pips: only shown when rolling or when activeFace !== null */}
            {(isRolling || activeFace !== null) &&
              renderPips(isRolling ? tumblingFace : (activeFace || 1))}
          </svg>

          {/* Idle State: PlayWebLudo Logo on plain white dice, no pips, no number */}
          {!isRolling && activeFace === null && (
            <div className="absolute inset-0 flex items-center justify-center p-3 pointer-events-none">
              <Image
                id="dice-idle-logo"
                src="/images/playweb-ludo-logo.png"
                alt="PlayWebLudo"
                width={36}
                height={36}
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain select-none pointer-events-none drop-shadow-sm"
              />
            </div>
          )}
        </div>
      </button>

      {/* Bonus Roll Badge */}
      {bonusReason && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] sm:text-xs shadow-lg animate-bounce z-20">
          Roll again! ({bonusReason === 'six' ? 'Rolled a 6 🎲' : bonusReason === 'capture' ? 'Captured pawn ⚔️' : 'Reached Home 🏆'})
        </div>
      )}

      {/* Helper text prompt below dice */}
      <div className="mt-2 text-center h-6">
        {isRolling ? (
          <span className="text-xs sm:text-sm font-bold text-yellow-400 animate-pulse">
            Rolling...
          </span>
        ) : currentRoll ? (
          <span className="text-xs sm:text-sm font-bold text-slate-300">
            Rolled {currentRoll} — Select a token
          </span>
        ) : activeFace ? (
          <span className="text-xs sm:text-sm font-bold text-amber-300">
            Rolled {activeFace}
          </span>
        ) : canRoll && !disabled && isMyTurn ? (
          <span className="text-xs sm:text-sm font-bold text-emerald-400 animate-bounce">
            Tap to Roll!
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            Waiting for turn
          </span>
        )}
      </div>
    </div>
  );
};
