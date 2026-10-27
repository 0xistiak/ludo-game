/**
 * SetupScreen.tsx
 *
 * Exact match of Screen 2 from design/ui-spec.png:
 * - Game Mode selector (1v1 Duel vs 2v2 Team Battle)
 * - Play Type selector (Local Pass & Play vs Online)
 * - Profile & Player name configuration
 * - Color selection
 * - Large green "Start Game →" primary CTA
 */

'use client';

import React, { useState } from 'react';
import { ArrowLeft, Users, Globe, Edit3, Check } from 'lucide-react';
import { GameMode, PlayerColor, GameConfig, getOppositeColor } from '@/engine';
import { AvatarSvg } from '../ui/AvatarSvg';
import { sound } from '@/utils/audio';
import { savePreferences } from '@/utils/storage';

interface SetupScreenProps {
  initialMode: GameMode;
  initialColor: PlayerColor;
  initialName: string;
  onBack: () => void;
  onStartGame: (config: GameConfig) => void;
  onOpenNotConfigured: (feature: string) => void;
  onOpenOnlineModal?: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
  initialMode,
  initialColor,
  initialName,
  onBack,
  onStartGame,
  onOpenNotConfigured,
  onOpenOnlineModal,
}) => {
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [playerColor, setPlayerColor] = useState<PlayerColor>(initialColor);

  // Player Names
  const [p1Name, setP1Name] = useState(initialName || 'Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [p3Name, setP3Name] = useState('Player 3');
  const [p4Name, setP4Name] = useState('Player 4');

  const handleStart = () => {
    sound.playButton();

    // Save preferences
    savePreferences({
      mode,
      playerColor,
      playerName: p1Name,
      player2Name: p2Name,
      player3Name: p3Name,
      player4Name: p4Name,
    });

    if (mode === '1v1') {
      const opposite = getOppositeColor(playerColor);
      onStartGame({
        mode: '1v1',
        players: [
          { name: p1Name.trim() || 'Player 1', color: playerColor },
          { name: p2Name.trim() || 'Player 2', color: opposite },
        ],
      });
    } else {
      // 2v2: Team A = Red + Yellow, Team B = Green + Blue
      onStartGame({
        mode: '2v2',
        players: [
          { name: p1Name.trim() || 'Player 1', color: 'red' },
          { name: p2Name.trim() || 'Player 2', color: 'green' },
          { name: p3Name.trim() || 'Player 3', color: 'yellow' },
          { name: p4Name.trim() || 'Player 4', color: 'blue' },
        ],
      });
    }
  };

  const colors: Array<{ color: PlayerColor; hex: string; label: string }> = [
    { color: 'red', hex: '#EF4444', label: 'Red' },
    { color: 'green', hex: '#22C55E', label: 'Green' },
    { color: 'yellow', hex: '#FACC15', label: 'Yellow' },
    { color: 'blue', hex: '#3B82F6', label: 'Blue' },
  ];

  return (
    <div className="relative w-full h-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-3 pb-2 z-10">
        <button
          type="button"
          onClick={() => {
            sound.playButton();
            onBack();
          }}
          className="w-10 h-10 rounded-2xl border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl sm:text-2xl font-black text-slate-100">Game Setup</h2>
      </div>

      <div className="space-y-4 my-2 z-10">
        {/* 1. Game Mode Section */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
            Game Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* 1v1 Card */}
            <button
              type="button"
              onClick={() => {
                sound.playButton();
                setMode('1v1');
              }}
              className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-2 border transition ${
                mode === '1v1'
                  ? 'bg-blue-600/30 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                  : 'glass-card border-slate-700/50 hover:border-slate-600 opacity-80'
              }`}
            >
              <div className="flex items-center -space-x-1.5">
                <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-slate-900 shadow" />
                <div className="w-5 h-5 rounded-full bg-yellow-400 border-2 border-slate-900 shadow" />
              </div>
              <div className="text-center">
                <div className="text-sm font-black text-slate-100">1v1</div>
                <div className="text-[11px] text-slate-400">Duel</div>
              </div>
            </button>

            {/* 2v2 Card */}
            <button
              type="button"
              onClick={() => {
                sound.playButton();
                setMode('2v2');
              }}
              className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-2 border transition ${
                mode === '2v2'
                  ? 'bg-purple-600/30 border-purple-400 shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                  : 'glass-card border-slate-700/50 hover:border-slate-600 opacity-80'
              }`}
            >
              <div className="flex items-center -space-x-1">
                <div className="w-4 h-4 rounded-full bg-red-500 border border-slate-900 shadow" />
                <div className="w-4 h-4 rounded-full bg-green-500 border border-slate-900 shadow" />
                <div className="w-4 h-4 rounded-full bg-yellow-400 border border-slate-900 shadow" />
                <div className="w-4 h-4 rounded-full bg-blue-500 border border-slate-900 shadow" />
              </div>
              <div className="text-center">
                <div className="text-sm font-black text-slate-100">2v2</div>
                <div className="text-[11px] text-slate-400">Team Battle</div>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Play Type Section */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
            Play Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Online Tab */}
            <button
              type="button"
              onClick={() => {
                sound.playButton();
                if (onOpenOnlineModal) onOpenOnlineModal();
                else onOpenNotConfigured('Online Multiplayer');
              }}
              className="p-3 rounded-2xl glass-card border border-slate-700/50 flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition"
            >
              <Globe size={18} className="text-blue-400" />
              <div className="text-left">
                <div className="text-xs font-bold text-slate-200">Online</div>
                <div className="text-[10px] text-blue-300 font-semibold">Multiplayer</div>
              </div>
            </button>

            {/* Local Tab (Active) */}
            <div className="p-3 rounded-2xl bg-blue-600/30 border border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2">
              <Users size={18} className="text-blue-300" />
              <div className="text-left">
                <div className="text-xs font-bold text-white">Local</div>
                <div className="text-[10px] text-blue-200">Pass & Play</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Your Profile / Player Name */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
            Your Profile
          </label>
          <div className="flex items-center gap-3 p-3 rounded-2xl glass-card border border-slate-700/60">
            <AvatarSvg color={playerColor} size={44} seed={0} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-slate-400 font-medium">Player 1 Name</div>
              <input
                id="player1-name-input"
                type="text"
                value={p1Name}
                maxLength={16}
                onChange={(e) => setP1Name(e.target.value)}
                className="w-full bg-transparent text-slate-100 font-bold text-sm focus:outline-none border-b border-transparent focus:border-blue-400 transition"
                placeholder="Enter name"
              />
            </div>
            <Edit3 size={18} className="text-slate-400" />
          </div>
        </div>

        {/* In 1v1 mode: Player 2 name */}
        {mode === '1v1' && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Opponent Profile
            </label>
            <div className="flex items-center gap-3 p-3 rounded-2xl glass-card border border-slate-700/60">
              <AvatarSvg color={getOppositeColor(playerColor)} size={44} seed={2} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-400 font-medium">Player 2 Name</div>
                <input
                  id="player2-name-input"
                  type="text"
                  value={p2Name}
                  maxLength={16}
                  onChange={(e) => setP2Name(e.target.value)}
                  className="w-full bg-transparent text-slate-100 font-bold text-sm focus:outline-none border-b border-transparent focus:border-blue-400 transition"
                  placeholder="Enter opponent name"
                />
              </div>
            </div>
          </div>
        )}

        {/* In 2v2 mode: Players 2, 3, and 4 names */}
        {mode === '2v2' && (
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Team Battle Lineup
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <div className="flex items-center gap-3 p-2.5 rounded-2xl glass-card border border-green-500/30">
                <AvatarSvg color="green" size={38} seed={1} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-green-300 font-bold uppercase">Player 2 (Team 2 • Green)</div>
                  <input
                    type="text"
                    value={p2Name}
                    maxLength={16}
                    onChange={(e) => setP2Name(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold text-xs focus:outline-none"
                    placeholder="Player 2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-2xl glass-card border border-yellow-500/30">
                <AvatarSvg color="yellow" size={38} seed={2} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-yellow-300 font-bold uppercase">Player 3 (Teammate • Yellow)</div>
                  <input
                    type="text"
                    value={p3Name}
                    maxLength={16}
                    onChange={(e) => setP3Name(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold text-xs focus:outline-none"
                    placeholder="Player 3"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-2xl glass-card border border-blue-500/30">
                <AvatarSvg color="blue" size={38} seed={3} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-blue-300 font-bold uppercase">Player 4 (Team 2 • Blue)</div>
                  <input
                    type="text"
                    value={p4Name}
                    maxLength={16}
                    onChange={(e) => setP4Name(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold text-xs focus:outline-none"
                    placeholder="Player 4"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Choose Your Color (1v1 mode) */}
        {mode === '1v1' && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Choose Your Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((c) => {
                const isSelected = playerColor === c.color;
                return (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => {
                      sound.playButton();
                      setPlayerColor(c.color);
                    }}
                    className={`py-2 px-1 rounded-2xl border flex flex-col items-center gap-1.5 transition ${
                      isSelected
                        ? 'border-white bg-slate-800 shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-105'
                        : 'glass-card border-slate-700/50 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-slate-900 shadow flex items-center justify-center"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && <Check size={16} className="text-white drop-shadow" />}
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Button: "Start Game →" */}
      <div className="pt-2 pb-1 z-10">
        <button
          id="start-game-button"
          type="button"
          onClick={handleStart}
          className="w-full py-4 px-6 rounded-2xl btn-green text-base sm:text-lg font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition"
        >
          Start Game →
        </button>
      </div>
    </div>
  );
};
