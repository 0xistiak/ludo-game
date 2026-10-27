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

import Image from 'next/image';

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
    <div className="relative w-full h-full max-w-md mx-auto flex flex-col justify-between p-3 sm:p-5 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between z-10 shrink-0">
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1 rounded-full border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700/60 transition shadow-lg"
          title="Profile & Settings"
        >
          <AvatarSvg color="red" size={34} seed={0} />
        </button>

        <button
          id="settings-button"
          type="button"
          onClick={() => {
            sound.playButton();
            onOpenSettings();
          }}
          className="w-9 h-9 rounded-2xl border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white transition shadow-lg"
          title="Settings"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      {/* Hero: PlayWebLudo Logo & Tagline */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center my-1 text-center">
        {/* PlayWebLudo Official Logo Image */}
        <div className="relative w-[85%] max-w-[340px] md:max-w-[420px] aspect-[1536/1024] max-h-[175px] sm:max-h-[220px] flex items-center justify-center">
          <Image
            id="playweb-ludo-logo"
            src="/images/playweb-ludo-logo.png"
            alt="PlayWebLudo"
            width={1536}
            height={1024}
            priority
            className="w-full h-full object-contain pointer-events-none drop-shadow-2xl"
          />
        </div>

        {/* PLAY TOGETHER Tagline Badge */}
        <div className="-mt-1 px-4 py-0.5 rounded-full bg-blue-600/90 border border-blue-400/80 text-[10px] sm:text-[11px] font-black tracking-widest text-white shadow-lg uppercase shrink-0">
          PLAY TOGETHER
        </div>

        {/* Big Golden Primary Action Button: "Play Now" */}
        <button
          id="play-now-button"
          type="button"
          onClick={() => handleModeClick('1v1')}
          className="w-full py-3 sm:py-3.5 px-6 rounded-2xl btn-gold text-base sm:text-lg font-black uppercase tracking-wider flex items-center justify-center gap-3 mt-2 active:scale-95 transition shadow-xl shrink-0"
        >
          <span className="text-lg">▶</span> Play Now
        </button>
      </div>

      {/* Game Mode List Cards */}
      <div className="space-y-1.5 sm:space-y-2.5 my-1.5 sm:my-2 z-10 shrink-0">
        <button
          id="mode-1v1-button"
          type="button"
          onClick={() => handleModeClick('1v1')}
          className="w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-2xl glass-card border border-blue-500/20 hover:border-blue-500/50 hover:bg-slate-800/80 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <Trophy size={20} />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-xs sm:text-base text-slate-100">1v1 Duel</div>
              <div className="text-[11px] sm:text-xs text-slate-400">Head-to-head match</div>
            </div>
          </div>
          <span className="text-blue-400 text-lg font-bold">›</span>
        </button>

        <button
          id="mode-2v2-button"
          type="button"
          onClick={() => handleModeClick('2v2')}
          className="w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-2xl glass-card border border-purple-500/20 hover:border-purple-500/50 hover:bg-slate-800/80 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">
              <Users size={20} />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-xs sm:text-base text-slate-100">2v2 Team Battle</div>
              <div className="text-[11px] sm:text-xs text-slate-400">Cooperative 4-player combat</div>
            </div>
          </div>
          <span className="text-purple-400 text-lg font-bold">›</span>
        </button>

        <button
          id="mode-friends-button"
          type="button"
          onClick={() => handleModeClick('1v1')}
          className="w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-2xl glass-card border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-slate-800/80 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <UserCheck size={20} />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-xs sm:text-base text-slate-100">Play with Friends</div>
              <div className="text-[11px] sm:text-xs text-slate-400">Pass & play locally</div>
            </div>
          </div>
          <span className="text-emerald-400 text-lg font-bold">›</span>
        </button>
      </div>

      {/* Bottom Action Row (Create Room, Join Room, Rules) */}
      <div className="grid grid-cols-3 gap-2 pt-1 pb-1 z-10 shrink-0">
        <button
          id="create-room-button"
          type="button"
          onClick={() => {
            sound.playButton();
            if (onCreateRoom) onCreateRoom();
            else onOpenNotConfigured('Create Online Room');
          }}
          className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition"
        >
          <span className="text-lg sm:text-xl mb-0.5 sm:mb-1">📦</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">Create Room</span>
        </button>

        <button
          id="join-room-button"
          type="button"
          onClick={() => {
            sound.playButton();
            if (onJoinRoom) onJoinRoom();
            else onOpenNotConfigured('Join Online Room');
          }}
          className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition"
        >
          <span className="text-lg sm:text-xl mb-0.5 sm:mb-1">🪙</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">Join Room</span>
        </button>

        <button
          id="rules-button"
          type="button"
          onClick={() => {
            sound.playButton();
            onOpenRules();
          }}
          className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 active:scale-95 transition"
        >
          <span className="text-lg sm:text-xl mb-0.5 sm:mb-1">📜</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">Rules</span>
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
