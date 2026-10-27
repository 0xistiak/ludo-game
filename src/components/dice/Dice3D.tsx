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

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PlayerColor } from '@/engine';
import { sound } from '@/utils/audio';

interface Dice3DProps {
  currentRoll: number | null;
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
  const isFirstMountRef = useRef(true);
  const lastHandledRollIdRef = useRef<string | number | null>(null);
  const currentRollRef = useRef<number | null>(currentRoll);

  useEffect(() => {
    currentRollRef.current = currentRoll;
  }, [currentRoll]);

  // Run the smooth ~600ms decelerating random tumble sequence
  const startTumble = (onComplete?: () => void) => {
    setIsRolling(true);
    sound.playDiceRoll();

    const delays = [40, 45, 50, 60, 75, 95, 115, 120];
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
        // Tumble sequence complete (~600ms total)
        setIsRolling(false);
        onComplete?.();
      }
    };

    timer = setTimeout(tick, delays[0]);

    return () => {
      if (timer) clearTimeout(timer);
    };
  };

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

    // If it's my turn, handleRollClick triggered the roll animation already
    if (isMyTurn) {
      lastHandledRollIdRef.current = rollId;
      return;
    }

    lastHandledRollIdRef.current = rollId;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Opponent's roll arrived: tumble asynchronously then display result
    let cleanupFn: (() => void) | undefined;
    const startTimer = setTimeout(() => {
      cleanupFn = startTumble();
    }, 0);

    return () => {
      clearTimeout(startTimer);
      cleanupFn?.();
    };
  }, [rollId, isMyTurn]);

  const handleRollClick = () => {
    if (!canRoll || disabled || isRolling) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onRoll();
      return;
    }

    // Call onRoll immediately so server request starts in parallel with animation
    onRoll();
    startTumble();
  };

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
        disabled={!canRoll || disabled || isRolling}
        className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-200 select-none ${
          canRoll && !disabled && !isRolling
            ? 'scale-100 hover:scale-105 active:scale-95 cursor-pointer'
            : 'opacity-70 cursor-not-allowed'
        }`}
        style={{
          background: `radial-gradient(circle, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 70%)`,
          boxShadow:
            canRoll && !disabled
              ? `0 0 25px ${glowColor}, inset 0 0 15px ${glowColor}`
              : '0 4px 15px rgba(0, 0, 0, 0.4)',
          border: `3px solid ${canRoll && !disabled ? glowColor : 'rgba(255, 255, 255, 0.1)'}`,
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

            {/* Pips: only shown when rolling or when currentRoll !== null */}
            {(isRolling || currentRoll !== null) && renderPips(isRolling ? tumblingFace : currentRoll!)}
          </svg>

          {/* Idle State: PlayWebLudo Logo on plain white dice, no pips, no number */}
          {!isRolling && currentRoll === null && (
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
        ) : canRoll && !disabled && isMyTurn ? (
          <span className="text-xs sm:text-sm font-bold text-emerald-400 animate-bounce">
            Tap to Roll!
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            {currentRoll ? `Rolled ${currentRoll} — Select a token` : 'Waiting for turn'}
          </span>
        )}
      </div>
    </div>
  );
};
