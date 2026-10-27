/**
 * Dice3D.tsx
 *
 * 3D-styled ivory dice with realistic recessed pips, tumbling animation,
 * glowing pod, and sound effect trigger matching design/ui-spec.png.
 */

'use client';

import React, { useState } from 'react';
import { PlayerColor } from '@/engine';
import { sound } from '@/utils/audio';

interface Dice3DProps {
  currentRoll: number | null;
  canRoll: boolean;
  activeColor: PlayerColor;
  onRoll: () => void;
  disabled?: boolean;
  bonusReason?: 'six' | 'capture' | 'home' | null;
  rollAttempts?: number;
  isAllInBase?: boolean;
}

export const Dice3D: React.FC<Dice3DProps> = ({
  currentRoll,
  canRoll,
  activeColor,
  onRoll,
  disabled = false,
  bonusReason,
  rollAttempts = 0,
  isAllInBase = false,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [tumblingFace, setTumblingFace] = useState<number>(6);

  const displayRoll = isRolling ? tumblingFace : (currentRoll ?? 6);

  const handleRollClick = () => {
    if (!canRoll || disabled || isRolling) return;

    setIsRolling(true);
    sound.playDiceRoll();

    // Tumble face animation over 480ms (strictly < 600ms)
    const interval = setInterval(() => {
      setTumblingFace(Math.floor(Math.random() * 6) + 1);
    }, 55);

    setTimeout(() => {
      clearInterval(interval);
      setIsRolling(false);
      onRoll();
    }, 480);
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
      <g key={i}>
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
        {/* 3D Dice SVG */}
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 transition-transform ${
            isRolling ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRolling
              ? 'rotate(720deg) scale(0.9)'
              : 'rotate(0deg) scale(1)',
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
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

            {/* Pips */}
            {renderPips(displayRoll)}
          </svg>
        </div>
      </button>

      {/* Bonus Roll and Attempts Badges */}
      {bonusReason && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] sm:text-xs shadow-lg animate-bounce z-20">
          Roll again! ({bonusReason === 'six' ? 'Rolled a 6 🎲' : bonusReason === 'capture' ? 'Captured pawn ⚔️' : 'Reached Home 🏆'})
        </div>
      )}

      {isAllInBase && !bonusReason && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-blue-600/90 border border-blue-400 text-white font-extrabold text-[10px] shadow z-20">
          3 tries to get a 6 {rollAttempts > 0 ? `(Try ${rollAttempts + 1}/3)` : ''}
        </div>
      )}

      {/* Helper text prompt below dice */}
      <div className="mt-2 text-center h-6">
        {isRolling ? (
          <span className="text-xs sm:text-sm font-bold text-yellow-400 animate-pulse">
            Rolling...
          </span>
        ) : canRoll && !disabled ? (
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
