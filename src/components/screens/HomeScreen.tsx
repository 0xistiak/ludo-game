/**
 * HomeScreen.tsx
 *
 * Exact match of Screen 1 from design/ui-spec.png:
 * - 3D Ludo vector illustration & crown badge
 * - Golden "Play Now" primary CTA
 * - 1v1 Duel / 2v2 Team Battle / Play with Friends cards
 * - Create Room, Join Room, Rules bottom row
 * - Footer: "Developed by istiak.tech"
 * Pure SVG/CSS, zero remote images.
 */

'use client';

import React from 'react';
import { Settings as SettingsIcon, Trophy, Users, UserCheck } from 'lucide-react';
import { AvatarSvg } from '../ui/AvatarSvg';
import { GameMode } from '@/engine';
import { sound } from '@/utils/audio';

interface HomeScreenProps {
  onStartSetup: (mode: GameMode) => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenNotConfigured: (feature: string) => void;
  onCreateRoom?: () => void;
  onJoinRoom?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartSetup,
  onOpenSettings,
  onOpenRules,
  onOpenNotConfigured,
  onCreateRoom,
  onJoinRoom,
}) => {
  const handleModeClick = (mode: GameMode) => {
    sound.playButton();
    onStartSetup(mode);
  };

  return (
    <div className="relative w-full h-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between z-10">
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1 rounded-full border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700/60 transition shadow-lg"
          title="Profile & Settings"
        >
          <AvatarSvg color="red" size={38} seed={0} />
        </button>

        <button
          id="settings-button"
          type="button"
          onClick={() => {
            sound.playButton();
            onOpenSettings();
          }}
          className="w-10 h-10 rounded-2xl border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white transition shadow-lg"
          title="Settings"
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      {/* Hero: 3D Ludo Logo & Artwork */}
      <div className="flex-1 flex flex-col items-center justify-center my-2 text-center select-none">
        {/* Crown & 3D Text Banner */}
        <div className="relative mb-2">
          {/* Golden Crown */}
          <div className="flex justify-center -mb-2">
            <svg width="48" height="32" viewBox="0 0 48 32" fill="none">
              <path
                d="M4,28 L8,8 L18,20 L24,4 L30,20 L40,8 L44,28 Z"
                fill="url(#crown-gold)"
                stroke="#FDE047"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="4" cy="7" r="3" fill="#FEF08A" />
              <circle cx="24" cy="3" r="3.5" fill="#FEF08A" />
              <circle cx="44" cy="7" r="3" fill="#FEF08A" />
              <defs>
                <linearGradient id="crown-gold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FDE047" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* LUDO 3D Title */}
          <h1
            className="text-5xl sm:text-6xl font-black tracking-wider text-transparent bg-clip-text drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            style={{
              backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #BAE6FD 30%, #38BDF8 60%, #0284C7 100%)',
              WebkitTextStroke: '1.5px #0369A1',
            }}
          >
            LUDO
          </h1>

          {/* PLAY TOGETHER Ribbon Badge */}
          <div className="-mt-1 px-4 py-1 rounded-full bg-blue-600/90 border border-blue-400 text-[11px] font-black tracking-widest text-white shadow-lg uppercase">
            PLAY TOGETHER
          </div>
        </div>

        {/* 3D Dice and Pawns Vector Scene */}
        <div className="w-48 h-32 relative flex items-center justify-center my-1">
          <svg viewBox="0 0 200 120" className="w-full h-full drop-shadow-2xl">
            {/* Pawns */}
            <g transform="translate(40, 60)">
              <ellipse cx="0" cy="22" rx="16" ry="7" fill="#000" opacity="0.3" />
              <circle cx="0" cy="-6" r="14" fill="#EF4444" stroke="#B91C1C" strokeWidth="1" />
              <path d="M-12,18 Q0,0 0,-6 Q0,0 12,18 Z" fill="#EF4444" />
              <ellipse cx="0" cy="18" rx="15" ry="6" fill="#DC2626" />
            </g>

            <g transform="translate(75, 45)">
              <ellipse cx="0" cy="22" rx="16" ry="7" fill="#000" opacity="0.3" />
              <circle cx="0" cy="-6" r="14" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" />
              <path d="M-12,18 Q0,0 0,-6 Q0,0 12,18 Z" fill="#3B82F6" />
              <ellipse cx="0" cy="18" rx="15" ry="6" fill="#2563EB" />
            </g>

            {/* 3D Dice */}
            <g transform="translate(130, 60) rotate(-12)">
              <rect x="-24" y="-24" width="48" height="48" rx="10" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
              <circle cx="-10" cy="-10" r="3.5" fill="#0F172A" />
              <circle cx="10" cy="10" r="3.5" fill="#0F172A" />
              <circle cx="0" cy="0" r="3.5" fill="#EF4444" />
            </g>
          </svg>
        </div>

        {/* Big Golden Primary Action Button: "Play Now" */}
        <button
          id="play-now-button"
          type="button"
          onClick={() => handleModeClick('1v1')}
          className="w-full py-4 px-6 rounded-2xl btn-gold text-lg sm:text-xl font-black uppercase tracking-wider flex items-center justify-center gap-3 mt-1 active:scale-95 transition"
        >
          <span className="text-xl">▶</span> Play Now
        </button>
      </div>

      {/* Game Mode List Cards */}
      <div className="space-y-2.5 my-3 z-10">
        <button
          id="mode-1v1-button"
          type="button"
          onClick={() => handleModeClick('1v1')}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl glass-card border border-blue-500/20 hover:border-blue-500/50 hover:bg-slate-800/80 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Trophy size={22} />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-sm sm:text-base text-slate-100">1v1 Duel</div>
              <div className="text-xs text-slate-400">Head-to-head match</div>
            </div>
          </div>
          <span className="text-blue-400 text-lg font-bold">›</span>
        </button>

        <button
          id="mode-2v2-button"
          type="button"
          onClick={() => handleModeClick('2v2')}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl glass-card border border-purple-500/20 hover:border-purple-500/50 hover:bg-slate-800/80 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <Users size={22} />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-sm sm:text-base text-slate-100">2v2 Team Battle</div>
              <div className="text-xs text-slate-400">Cooperative 4-player combat</div>
            </div>
          </div>
          <span className="text-purple-400 text-lg font-bold">›</span>
        </button>

        <button
          id="mode-friends-button"
          type="button"
          onClick={() => handleModeClick('1v1')}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl glass-card border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-slate-800/80 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <UserCheck size={22} />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-sm sm:text-base text-slate-100">Play with Friends</div>
              <div className="text-xs text-slate-400">Pass & play locally</div>
            </div>
          </div>
          <span className="text-emerald-400 text-lg font-bold">›</span>
        </button>
      </div>

      {/* Bottom Action Row (Create Room, Join Room, Rules) */}
      <div className="grid grid-cols-3 gap-2 pt-1 pb-2 z-10">
        <button
          id="create-room-button"
          type="button"
          onClick={() => {
            sound.playButton();
            if (onCreateRoom) onCreateRoom();
            else onOpenNotConfigured('Create Online Room');
          }}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition"
        >
          <span className="text-xl mb-1">📦</span>
          <span className="text-[11px] font-bold text-slate-200">Create Room</span>
        </button>

        <button
          id="join-room-button"
          type="button"
          onClick={() => {
            sound.playButton();
            if (onJoinRoom) onJoinRoom();
            else onOpenNotConfigured('Join Online Room');
          }}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition"
        >
          <span className="text-xl mb-1">🪙</span>
          <span className="text-[11px] font-bold text-slate-200">Join Room</span>
        </button>

        <button
          id="rules-button"
          type="button"
          onClick={() => {
            sound.playButton();
            onOpenRules();
          }}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition"
        >
          <span className="text-xl mb-1">📜</span>
          <span className="text-[11px] font-bold text-slate-200">Rules</span>
        </button>
      </div>

      {/* Mandatory Footer Text */}
      <footer className="text-center py-1 z-10">
        <span className="text-xs text-slate-400 font-medium tracking-wide">
          Developed by <a href="https://istiak.tech" target="_blank" rel="noreferrer" className="text-blue-400 font-bold hover:underline">istiak.tech</a>
        </span>
      </footer>
    </div>
  );
};
