/**
 * GameplayScreen.tsx
 *
 * Full gameplay orchestrator matching Screen 3 from design/ui-spec.png:
 * - 4 player cards (or 2 in 1v1) with active turn glow, name, and mini token dots
 * - Responsive SVG Ludo Board fitting 100dvh without page scroll
 * - 3D Dice with tumbling animation and roll sound
 * - Turn prompt banner & move logs
 * - Pause/Restart dialog and Sound toggle
 */

'use client';

import React, { useState } from 'react';
import { RotateCcw, Volume2, VolumeX, MessageSquare, Smile, Settings as SettingsIcon } from 'lucide-react';
import {
  GameState,
  applyMove,
  rollDice,
} from '@/engine';
import { LudoBoard } from '../board/LudoBoard';
import { Dice3D } from '../dice/Dice3D';
import { PlayerCard } from '../gameplay/PlayerCard';
import { sound } from '@/utils/audio';

interface GameplayScreenProps {
  gameState: GameState;
  onUpdateState: (newState: GameState) => void;
  onRequestRestart: () => void;
  onOpenSettings: () => void;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  gameState,
  onUpdateState,
  onRequestRestart,
  onOpenSettings,
  soundEnabled,
  onToggleSound,
}) => {
  const { mode, players, activePlayerIndex, phase, currentRoll, legalMoves, tokens } = gameState;
  const activePlayer = players[activePlayerIndex];

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Handle dice roll
  const handleRoll = () => {
    try {
      const result = rollDice(gameState);
      onUpdateState(result.state);

      if (result.legalMoves.length === 0) {
        showToast(`${activePlayer.name} rolled ${result.roll} — No moves! Turn skipped.`);
      } else if (result.roll === 6) {
        if (result.state.consecutiveSixes === 1) {
          showToast('Rolled a 6! You get an extra roll after moving!');
        } else if (result.state.consecutiveSixes === 2) {
          showToast('Two 6s in a row! Careful: 3rd six forfeits turn!');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle token selection to move
  const handleSelectToken = (tokenId: string) => {
    if (phase !== 'need_move') return;
    if (!legalMoves.includes(tokenId)) return;

    try {
      const nextState = applyMove(gameState, tokenId);

      // Audio feedback
      if (nextState.lastMove?.reachedHome) {
        sound.playHomeFinish();
        showToast(`🎉 ${activePlayer.name}'s pawn reached Home!`);
      } else if ((nextState.lastMove?.capturedTokenIds.length || 0) > 0) {
        sound.playCapture();
        showToast(`⚔️ Captured opponent pawn!`);
      } else {
        sound.playTokenStep();
      }

      onUpdateState(nextState);
    } catch (e) {
      console.error(e);
    }
  };

  // For 1v1 mode, map to 2 players. For 2v2, map to 4 players.
  const pRed = players.find((p) => p.color === 'red');
  const pGreen = players.find((p) => p.color === 'green');
  const pYellow = players.find((p) => p.color === 'yellow');
  const pBlue = players.find((p) => p.color === 'blue');

  return (
    <div className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between p-2 sm:p-4 overflow-hidden select-none">
      {/* Top Header Control Bar */}
      <div className="flex items-center justify-between px-1 py-1 z-20">
        <button
          id="restart-match-button"
          type="button"
          onClick={() => {
            sound.playButton();
            onRequestRestart();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card border border-slate-700/60 hover:bg-slate-800 text-xs font-bold text-slate-300 transition"
          title="Restart Game"
        >
          <RotateCcw size={15} /> Restart
        </button>

        <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-black tracking-wider text-slate-200">
          {mode === '1v1' ? '1v1 DUEL' : '2v2 TEAM BATTLE'}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleSound(!soundEnabled)}
            className="w-8 h-8 rounded-xl glass-card border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white transition"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playButton();
              onOpenSettings();
            }}
            className="w-8 h-8 rounded-xl glass-card border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white transition"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </div>

      {/* Top Player Cards */}
      <div className="grid grid-cols-2 gap-2 my-1 z-10">
        {mode === '1v1' ? (
          <>
            <PlayerCard
              player={players[0]}
              isActive={activePlayerIndex === 0}
              tokens={tokens}
              mode={mode}
            />
            <PlayerCard
              player={players[1]}
              isActive={activePlayerIndex === 1}
              tokens={tokens}
              mode={mode}
              align="right"
            />
          </>
        ) : (
          <>
            {pRed && (
              <PlayerCard
                player={pRed}
                isActive={activePlayer.color === 'red'}
                tokens={tokens}
                mode={mode}
              />
            )}
            {pGreen && (
              <PlayerCard
                player={pGreen}
                isActive={activePlayer.color === 'green'}
                tokens={tokens}
                mode={mode}
                align="right"
              />
            )}
          </>
        )}
      </div>

      {/* Main Board Container */}
      <div className="flex-1 flex items-center justify-center my-0.5 z-10 w-full min-h-0">
        <LudoBoard
          gameState={gameState}
          onSelectToken={handleSelectToken}
        />
      </div>

      {/* Bottom Player Cards (for 2v2 mode) */}
      {mode === '2v2' && (
        <div className="grid grid-cols-2 gap-2 my-1 z-10">
          {pBlue && (
            <PlayerCard
              player={pBlue}
              isActive={activePlayer.color === 'blue'}
              tokens={tokens}
              mode={mode}
            />
          )}
          {pYellow && (
            <PlayerCard
              player={pYellow}
              isActive={activePlayer.color === 'yellow'}
              tokens={tokens}
              mode={mode}
              align="right"
            />
          )}
        </div>
      )}

      {/* Floating Status Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-slate-900/95 border border-amber-400/80 shadow-2xl text-xs sm:text-sm font-bold text-amber-300 text-center animate-bounce max-w-[90%]">
          {toastMessage}
        </div>
      )}

      {/* Bottom Action Area: 3D Dice & Quick Chat Buttons */}
      <div className="flex items-center justify-between px-3 pt-1 pb-2 z-10">
        {/* Chat / Emoji reactions button */}
        <button
          type="button"
          onClick={() => {
            sound.playButton();
            showToast('💬 Good luck, have fun!');
          }}
          className="w-10 h-10 rounded-2xl glass-card border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
          title="Send Reaction"
        >
          <Smile size={20} />
        </button>

        {/* 3D Dice */}
        <Dice3D
          currentRoll={currentRoll}
          canRoll={phase === 'need_roll'}
          activeColor={activePlayer.color}
          onRoll={handleRoll}
        />

        {/* Rules quick preview button */}
        <button
          type="button"
          onClick={() => {
            sound.playButton();
            onOpenSettings();
          }}
          className="w-10 h-10 rounded-2xl glass-card border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
          title="Game Info"
        >
          <MessageSquare size={20} />
        </button>
      </div>
    </div>
  );
};
