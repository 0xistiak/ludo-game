/**
 * GameplayScreen.tsx
 *
 * Full gameplay orchestrator matching Screen 3 from design/ui-spec.png:
 * - 4 player cards (or 2 in 1v1) with active turn glow, name, and mini token dots
 * - Responsive SVG Ludo Board fitting 100dvh without page scroll
 * - 3D Dice with tumbling animation, roll sound, and bonus/attempts badges
 * - Auto-move after ~350ms when exactly one legal choice exists (with settings toggle)
 * - "No move" toast for ~700ms when roll produces no moves
 * - Locked inputs during movement animation with instant unlock when done
 * - Turn prompt banner & move logs
 * - Pause/Restart dialog and Sound toggle
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Volume2, VolumeX, MessageSquare, Smile, Settings as SettingsIcon, Menu } from 'lucide-react';
import {
  GameState,
  applyMove,
  rollDice,
  getAutoMove,
} from '@/engine';
import { LudoBoard } from '../board/LudoBoard';
import { Dice3D } from '../dice/Dice3D';
import { PlayerCard } from '../gameplay/PlayerCard';
import { GameMenuModal, ConfirmLeaveModal, PlayerLeftModal } from '../modals/Modals';
import { sound } from '@/utils/audio';
import { RoomPlayerRow } from '@/types/multiplayer';

interface GameplayScreenProps {
  gameState: GameState;
  onUpdateState: (newState: GameState) => void;
  onRequestRestart: () => void;
  onOpenSettings: () => void;
  onOpenRules?: () => void;
  onRequestLeave?: () => void;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  isOnline?: boolean;
  myColor?: string;
  onOnlineRoll?: () => Promise<void>;
  onOnlineMove?: (tokenId: string) => Promise<void>;
  roomCode?: string;
  isReconnecting?: boolean;
  isConnected?: boolean;
  onlinePlayers?: RoomPlayerRow[];
  autoMoveEnabled?: boolean;
  opponentLeft?: boolean;
  onHome?: () => void;
  onRematch?: () => void;
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  gameState,
  onUpdateState,
  onRequestRestart,
  onOpenSettings,
  onOpenRules,
  onRequestLeave,
  soundEnabled,
  onToggleSound,
  isOnline = false,
  myColor,
  onOnlineRoll,
  onOnlineMove,
  roomCode,
  isReconnecting = false,
  isConnected = true,
  onlinePlayers,
  autoMoveEnabled = true,
  opponentLeft = false,
  onHome,
  onRematch,
}) => {
  const { mode, players, activePlayerIndex, phase, currentRoll, diceValue, legalMoves, tokens } = gameState;
  const activePlayer = players[activePlayerIndex];

  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isNoMovePause, setIsNoMovePause] = useState<boolean>(false);

  // Auto-move execution guard to avoid double moves
  const autoMoveExecutingRef = useRef<boolean>(false);

  const showToast = (msg: string, durationMs = 2500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), durationMs);
  };

  const isMyTurn =
    !isOnline ||
    (Boolean(myColor) && activePlayer.color.toLowerCase() === myColor?.toLowerCase());

  const isPhaseRoll = phase === 'awaiting-roll' || phase === 'need_roll';
  const isPhaseMove = phase === 'awaiting-move' || phase === 'need_move';

  // Handle token selection to move
  const handleSelectToken = React.useCallback(
    (tokenId: string) => {
      if (!isPhaseMove || isAnimating) return;

      // Check legality or equivalence
      const isDirectlyLegal = legalMoves.includes(tokenId);
      let isEquivalent = false;

      if (!isDirectlyLegal) {
        const tapped = tokens[tokenId];
        if (tapped) {
          for (const legalId of legalMoves) {
            const lt = tokens[legalId];
            if (lt && lt.color === tapped.color && lt.step === tapped.step) {
              isEquivalent = true;
              break;
            }
          }
        }
      }

      if (!isDirectlyLegal && !isEquivalent) return;

      if (isOnline) {
        if (!isMyTurn) {
          showToast(`It is ${activePlayer.name}'s turn!`);
          return;
        }
        if (onOnlineMove) {
          onOnlineMove(tokenId).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Move failed';
            showToast(msg);
          });
        }
        return;
      }

      try {
        const nextState = applyMove(gameState, tokenId);

        // Audio feedback
        if (nextState.lastMove?.reachedHome) {
          sound.playHomeFinish();
          showToast(`🎉 ${activePlayer.name}'s pawn reached Home! Bonus roll!`);
        } else if ((nextState.lastMove?.capturedTokenIds.length || 0) > 0) {
          sound.playCapture();
          showToast(`⚔️ Captured opponent pawn! Bonus roll!`);
        } else {
          sound.playTokenStep();
        }

        onUpdateState(nextState);
      } catch (e: unknown) {
        console.error(e);
      }
    },
    [isPhaseMove, isAnimating, legalMoves, tokens, isOnline, isMyTurn, onOnlineMove, activePlayer, gameState, onUpdateState]
  );

  // Auto-move after ~350ms if exactly one legal choice exists
  useEffect(() => {
    if (!isPhaseMove || !isMyTurn || isAnimating || isNoMovePause) {
      autoMoveExecutingRef.current = false;
      return;
    }

    const singleMove = getAutoMove(gameState);
    if (!singleMove || !autoMoveEnabled || autoMoveExecutingRef.current) {
      return;
    }

    autoMoveExecutingRef.current = true;
    const timer = setTimeout(() => {
      handleSelectToken(singleMove);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [isPhaseMove, isMyTurn, isAnimating, isNoMovePause, gameState, autoMoveEnabled, handleSelectToken]);

  // Show toast when 3 consecutive sixes cancels and reverts turn (online and local)
  const lastRevertedToastTurnRef = useRef<number | null>(null);
  useEffect(() => {
    if (gameState.revertedTurn && gameState.revertedTurn.turnCount !== lastRevertedToastTurnRef.current) {
      lastRevertedToastTurnRef.current = gameState.revertedTurn.turnCount;
      showToast('Three 6s! Turn cancelled', 2000);
      sound.playError();
    }
  }, [gameState.revertedTurn]);

  // Handle dice roll
  const handleRoll = () => {
    if (isAnimating || isNoMovePause) return;

    if (isOnline) {
      if (!isMyTurn) {
        showToast(`It is ${activePlayer.name}'s turn!`);
        return;
      }
      if (onOnlineRoll) {
        onOnlineRoll().catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Roll failed';
          showToast(msg);
        });
      }
      return;
    }

    try {
      const result = rollDice(gameState);

      if (result.state.revertedTurn) {
        showToast('Three 6s! Turn cancelled', 2000);
        sound.playError();
        onUpdateState(result.state);
        return;
      }

      if (result.legalMoves.length === 0) {
        // Show "No move" for ~700ms then pass
        showToast('No move', 700);
        setIsNoMovePause(true);
        setTimeout(() => {
          setIsNoMovePause(false);
          onUpdateState(result.state);
        }, 700);
      } else {
        onUpdateState(result.state);

        if (result.roll === 6) {
          if (result.state.consecutiveSixes === 1) {
            showToast('Rolled a 6! You get an extra roll after moving!');
          } else if (result.state.consecutiveSixes === 2) {
            showToast('Two 6s in a row! Careful: 3rd six forfeits turn!');
          }
        }
      }
    } catch (e: unknown) {
      console.error(e);
    }
  };

  // For 1v1 mode, map to 2 players. For 2v2, map to 4 players.
  const pRed = players.find((p) => p.color === 'red');
  const pGreen = players.find((p) => p.color === 'green');
  const pYellow = players.find((p) => p.color === 'yellow');
  const pBlue = players.find((p) => p.color === 'blue');

  const activeRoll = currentRoll ?? diceValue;
  const bonusReason =
    gameState.bonusRoll?.reason ||
    (gameState.lastMove?.awardedExtraTurn ? gameState.lastMove.bonusReason : null);

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
          title={isOnline ? 'Leave Match' : 'Restart Game'}
        >
          <RotateCcw size={15} /> {isOnline ? 'Leave' : 'Restart'}
        </button>

        <div className="flex items-center gap-1.5">
          <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-black tracking-wider text-slate-200">
            {isOnline ? `ROOM ${roomCode || ''}` : mode === '1v1' ? '1v1 DUEL' : '2v2 TEAM BATTLE'}
          </div>
          {isOnline && (
            isReconnecting ? (
              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Reconnecting...
              </span>
            ) : isConnected ? (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Connected
              </span>
            ) : (
              <span className="text-[10px] text-rose-400 font-bold bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Offline
              </span>
            )
          )}
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

          <button
            id="game-menu-button"
            type="button"
            onClick={() => {
              sound.playButton();
              setMenuOpen(true);
            }}
            className="w-8 h-8 rounded-xl glass-card border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white transition"
            title="Menu"
          >
            <Menu size={16} />
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
              isYou={isOnline && Boolean(myColor && players[0].color.toLowerCase() === myColor.toLowerCase())}
              isHost={isOnline && Boolean(onlinePlayers?.find((op) => op.color.toLowerCase() === players[0].color.toLowerCase())?.is_host)}
            />
            <PlayerCard
              player={players[1]}
              isActive={activePlayerIndex === 1}
              tokens={tokens}
              mode={mode}
              align="right"
              isYou={isOnline && Boolean(myColor && players[1].color.toLowerCase() === myColor.toLowerCase())}
              isHost={isOnline && Boolean(onlinePlayers?.find((op) => op.color.toLowerCase() === players[1].color.toLowerCase())?.is_host)}
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
                isYou={isOnline && Boolean(myColor && pRed.color.toLowerCase() === myColor.toLowerCase())}
                isHost={isOnline && Boolean(onlinePlayers?.find((op) => op.color.toLowerCase() === pRed.color.toLowerCase())?.is_host)}
              />
            )}
            {pGreen && (
              <PlayerCard
                player={pGreen}
                isActive={activePlayer.color === 'green'}
                tokens={tokens}
                mode={mode}
                align="right"
                isYou={isOnline && Boolean(myColor && pGreen.color.toLowerCase() === myColor.toLowerCase())}
                isHost={isOnline && Boolean(onlinePlayers?.find((op) => op.color.toLowerCase() === pGreen.color.toLowerCase())?.is_host)}
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
          onAnimationStateChange={setIsAnimating}
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
              isYou={isOnline && Boolean(myColor && pBlue.color.toLowerCase() === myColor.toLowerCase())}
              isHost={isOnline && Boolean(onlinePlayers?.find((op) => op.color.toLowerCase() === pBlue.color.toLowerCase())?.is_host)}
            />
          )}
          {pYellow && (
            <PlayerCard
              player={pYellow}
              isActive={activePlayer.color === 'yellow'}
              tokens={tokens}
              mode={mode}
              align="right"
              isYou={isOnline && Boolean(myColor && pYellow.color.toLowerCase() === myColor.toLowerCase())}
              isHost={isOnline && Boolean(onlinePlayers?.find((op) => op.color.toLowerCase() === pYellow.color.toLowerCase())?.is_host)}
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

      {/* Turn indicator text: "Your turn – tap the dice" vs "Waiting for <name>" */}
      <div className="w-full flex justify-center px-4 my-1 z-20">
        <div
          className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-black tracking-wide border flex items-center gap-2 shadow-lg transition-all ${
            isMyTurn
              ? 'bg-blue-600/30 border-blue-400/60 text-blue-200 animate-pulse'
              : 'bg-slate-800/90 border-slate-700 text-slate-300'
          }`}
        >
          {isMyTurn ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>
                {isPhaseRoll
                  ? 'Your turn – tap the dice'
                  : 'Your turn – select a pawn to move'}
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Waiting for {activePlayer.name}...</span>
            </>
          )}
        </div>
      </div>

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

        {/* 3D Dice with bonus badge */}
        <Dice3D
          currentRoll={activeRoll}
          canRoll={isPhaseRoll && isMyTurn && !isAnimating && !isNoMovePause}
          disabled={!isPhaseRoll || !isMyTurn || isAnimating || isNoMovePause}
          activeColor={activePlayer.color}
          onRoll={handleRoll}
          bonusReason={bonusReason}
          rollId={`${gameState.turnCount}_${activeRoll ?? 'none'}_${gameState.consecutiveSixes}_${isOnline ? (roomCode || 'online') : 'local'}`}
          isMyTurn={isMyTurn}
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

      {/* In-Game Menu Modal */}
      <GameMenuModal
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onResume={() => setMenuOpen(false)}
        onRequestRestart={() => {
          setMenuOpen(false);
          onRequestRestart();
        }}
        onOpenSettings={() => {
          setMenuOpen(false);
          onOpenSettings();
        }}
        onOpenRules={() => {
          setMenuOpen(false);
          onOpenRules?.();
        }}
        onRequestLeave={() => {
          setMenuOpen(false);
          setLeaveModalOpen(true);
        }}
      />

      {/* Confirm Leave Modal */}
      <ConfirmLeaveModal
        isOpen={leaveModalOpen}
        onConfirm={() => {
          setLeaveModalOpen(false);
          onRequestLeave?.();
        }}
        onCancel={() => setLeaveModalOpen(false)}
        isOnline={isOnline}
      />

      {/* Opponent Left / Abandoned Modal */}
      {opponentLeft && (
        <PlayerLeftModal
          isOpen={true}
          onHome={() => onHome?.()}
          onRematch={() => onRematch?.()}
        />
      )}
    </div>
  );
};
