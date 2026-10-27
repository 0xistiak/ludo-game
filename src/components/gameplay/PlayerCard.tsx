/**
 * PlayerCard.tsx
 *
 * Player status card matching design/ui-spec.png.
 * Shows avatar, name, color tag, teammate badge (in 2v2),
 * 4 mini token status indicators, and prominent active turn glow with text label.
 */

'use client';

import React from 'react';
import { Player, PlayerColor, Token, GameMode, STEP_BASE, STEP_HOME_GOAL } from '@/engine';
import { AvatarSvg } from '../ui/AvatarSvg';

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
  tokens: Record<string, Token>;
  mode: GameMode;
  align?: 'left' | 'right';
  className?: string;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isActive,
  tokens,
  mode,
  className = '',
}) => {
  const colorBorders: Record<PlayerColor, string> = {
    red: '#EF4444',
    green: '#22C55E',
    yellow: '#FACC15',
    blue: '#3B82F6',
  };

  const colorLabels: Record<PlayerColor, string> = {
    red: 'Red',
    green: 'Green',
    yellow: 'Yellow',
    blue: 'Blue',
  };

  const colorBgBadges: Record<PlayerColor, string> = {
    red: 'bg-red-500/20 text-red-300 border-red-500/40',
    green: 'bg-green-500/20 text-green-300 border-green-500/40',
    yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  };

  const colorHex = colorBorders[player.color];

  // Token status summary: count tokens in base, on track, and home
  const playerTokens = player.tokenIds.map((id) => tokens[id]).filter(Boolean);
  const homeCount = playerTokens.filter((t) => t.step === STEP_HOME_GOAL).length;

  return (
    <div
      className={`relative flex items-center gap-2.5 p-2 rounded-xl transition-all duration-200 glass-card ${
        isActive ? 'ring-2 ring-offset-2 ring-offset-slate-900' : 'opacity-85'
      } ${className}`}
      style={{
        borderColor: isActive ? colorHex : 'rgba(255, 255, 255, 0.1)',
        boxShadow: isActive ? `0 0 16px ${colorHex}55` : undefined,
      }}
    >
      {/* Avatar */}
      <AvatarSvg
        color={player.color}
        size={40}
        seed={player.color === 'red' ? 0 : player.color === 'green' ? 1 : player.color === 'yellow' ? 2 : 3}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-xs sm:text-sm text-slate-100 truncate">
            {player.name}
          </span>

          {/* Explicit Active Turn Label */}
          {isActive && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md text-white animate-pulse"
              style={{ backgroundColor: colorHex }}
            >
              TURN
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          {/* Color Label */}
          <span
            className={`px-1.5 py-0.2 text-[10px] font-semibold border rounded ${colorBgBadges[player.color]}`}
          >
            {colorLabels[player.color]}
          </span>

          {/* 2v2 Teammate Badge */}
          {mode === '2v2' && player.team && (
            <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
              {player.team === 'teamA' ? 'Team 1' : 'Team 2'}
            </span>
          )}
        </div>

        {/* 4 Mini Token Status Dots */}
        <div className="flex items-center gap-1 mt-1.5">
          {playerTokens.map((token, i) => {
            const isHome = token.step === STEP_HOME_GOAL;
            const isOnBoard = token.step > STEP_BASE && !isHome;
            return (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full border transition-all"
                style={{
                  backgroundColor: isHome
                    ? '#FACC15' // Gold for finished home
                    : isOnBoard
                    ? colorHex // Active player color
                    : 'transparent', // In yard
                  borderColor: colorHex,
                }}
                title={
                  isHome
                    ? 'Home (Finished)'
                    : isOnBoard
                    ? `Step ${token.step}`
                    : 'In Base Yard'
                }
              />
            );
          })}
          {homeCount > 0 && (
            <span className="text-[10px] text-amber-400 font-bold ml-0.5">
              {homeCount}/4
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
