/**
 * ResultScreen.tsx
 *
 * Exact match of Screen 5 from design/ui-spec.png:
 * - Golden crown & victory celebration banner
 * - Winner profile, team banner, and match statistics
 * - Play Again (gold), Rematch (blue), Home, and Share Room buttons
 * - Confetti celebration trigger
 */

'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Home, Share2, RotateCcw } from 'lucide-react';
import { GameState, PlayerColor } from '@/engine';
import { AvatarSvg } from '../ui/AvatarSvg';
import { sound } from '@/utils/audio';

interface ResultScreenProps {
  gameState: GameState;
  onPlayAgain: () => void;
  onHome: () => void;
  onShare: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  gameState,
  onPlayAgain,
  onHome,
  onShare,
}) => {
  const { winner, winnerTeam, mode, players, turnCount } = gameState;

  useEffect(() => {
    sound.playVictory();

    // Trigger celebratory confetti burst
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#EF4444', '#22C55E', '#FACC15', '#3B82F6', '#8B5CF6'],
      });
    } catch {
      // Graceful fallback if confetti fails
    }
  }, []);

  // Determine winner label & colors
  let winnerTitle = 'VICTORY!';
  let winnerSubtitle = '';
  let winningColor: PlayerColor = 'red';

  if (mode === '1v1') {
    const winningPlayer = players.find((p) => p.color === winner);
    winningColor = (winner as PlayerColor) || 'red';
    winnerTitle = 'YOU WIN!';
    winnerSubtitle = winningPlayer ? `${winningPlayer.name} takes the crown!` : '';
  } else {
    const teamName = winnerTeam === 'teamA' ? 'TEAM RED & YELLOW' : 'TEAM GREEN & BLUE';
    winningColor = winnerTeam === 'teamA' ? 'red' : 'green';
    winnerTitle = `${teamName} WINS!`;
    winnerSubtitle = 'Cooperative 2v2 Championship';
  }

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto flex flex-col justify-between p-3 sm:p-5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pl-[calc(0.75rem+env(safe-area-inset-left,0px))] pr-[calc(0.75rem+env(safe-area-inset-right,0px))] overflow-hidden select-none">
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 flex flex-col justify-center">
        {/* Top Victory Crown Header */}
        <div className="flex flex-col items-center text-center mt-1 z-10 select-none">
        {/* Golden Crown */}
        <div className="w-20 h-16 relative flex items-center justify-center mb-1">
          <svg viewBox="0 0 100 80" className="w-full h-full drop-shadow-[0_0_15px_rgba(250,204,21,0.7)]">
            <defs>
              <linearGradient id="crown-shine" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="50%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <path
              d="M10,70 L20,25 L40,50 L50,15 L60,50 L80,25 L90,70 Z"
              fill="url(#crown-shine)"
              stroke="#FDE047"
              strokeWidth="2.5"
            />
            <circle cx="10" cy="22" r="5" fill="#FFFFFF" />
            <circle cx="50" cy="12" r="6" fill="#FFFFFF" />
            <circle cx="90" cy="22" r="5" fill="#FFFFFF" />
          </svg>
        </div>

        {/* 3D Red & Gold Victory Banner */}
        <div className="relative px-8 py-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-red-600 border-2 border-yellow-400 shadow-[0_8px_30px_rgba(239,68,68,0.5)]">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase drop-shadow">
            {winnerTitle}
          </h2>
          {winnerSubtitle && (
            <div className="text-xs text-yellow-200 font-bold tracking-wide mt-0.5">
              {winnerSubtitle}
            </div>
          )}
        </div>
      </div>

      {/* Winner Spotlight Card */}
      <div className="flex flex-col items-center justify-center my-4 p-4 rounded-3xl glass-card border border-amber-500/30 shadow-2xl z-10">
        <div className="relative mb-3">
          <AvatarSvg color={winningColor} size={84} seed={winningColor === 'red' ? 0 : 1} />
          <div className="absolute -bottom-2 -right-1 bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full border border-white shadow">
            1ST
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 w-full mt-2 pt-3 border-t border-slate-700/60 text-center">
          <div className="p-2 rounded-xl bg-slate-800/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Mode</div>
            <div className="text-sm font-black text-slate-100">{mode.toUpperCase()}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total Turns</div>
            <div className="text-sm font-black text-amber-400">{turnCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Pawns Home</div>
            <div className="text-sm font-black text-emerald-400">{mode === '1v1' ? '4/4' : '8/8'}</div>
          </div>
        </div>
      </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 z-10 shrink-0 pt-1">
        <button
          id="play-again-button"
          type="button"
          onClick={() => {
            sound.playButton();
            onPlayAgain();
          }}
          className="w-full py-3.5 px-6 rounded-2xl btn-gold text-base sm:text-lg font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <RotateCcw size={20} /> Play Again
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playButton();
            onPlayAgain();
          }}
          className="w-full py-3 px-6 rounded-2xl btn-blue text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition"
        >
          Rematch
        </button>

        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            id="home-button"
            type="button"
            onClick={() => {
              sound.playButton();
              onHome();
            }}
            className="flex items-center justify-center gap-2 p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition text-xs font-bold text-slate-200"
          >
            <Home size={16} /> Home
          </button>

          <button
            id="share-room-button"
            type="button"
            onClick={() => {
              sound.playButton();
              onShare();
            }}
            className="flex items-center justify-center gap-2 p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition text-xs font-bold text-slate-200"
          >
            <Share2 size={16} /> Share Match
          </button>
        </div>
      </div>
    </div>
  );
};
