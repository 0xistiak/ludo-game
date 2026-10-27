'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomRow, RoomPlayerRow } from '@/types/multiplayer';
import { sound } from '@/utils/audio';

export interface OnlineLobbyScreenProps {
  room: RoomRow;
  players: RoomPlayerRow[];
  me: RoomPlayerRow | null;
  isHost: boolean;
  onToggleReady: (ready: boolean) => void;
  onStartGame: () => Promise<void>;
  onLeave: () => void;
  isReconnecting?: boolean;
  isConnected?: boolean;
}

const COLOR_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  RED: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/40',
    text: 'text-red-400',
    dot: '#EF4444',
  },
  GREEN: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    dot: '#22C55E',
  },
  YELLOW: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    dot: '#FACC15',
  },
  BLUE: {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/40',
    text: 'text-blue-400',
    dot: '#3B82F6',
  },
};

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({
  room,
  players,
  me,
  isHost,
  onToggleReady,
  onStartGame,
  onLeave,
  isReconnecting = false,
  isConnected = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxPlayers = room.mode === '1v1' ? 2 : 4;
  const isMeReady = me?.is_ready ?? false;

  const handleCopyCode = () => {
    sound.playButton();
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    sound.playButton();
    const shareText = `Join my Ludo room: ${room.code}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'PlayWebLudo',
          text: shareText,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        });
        return;
      } catch {
        // Fall back to copy
      }
    }
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReady = () => {
    sound.playButton();
    onToggleReady(!isMeReady);
  };

  const handleStartGameClick = async () => {
    sound.playButton();
    setIsStarting(true);
    setErrorMessage(null);
    try {
      await onStartGame();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start game';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setIsStarting(false);
    }
  };

  // Build fixed slots for 1v1 (2 slots) or 2v2 (4 slots)
  const slots: (RoomPlayerRow | null)[] = [];
  for (let i = 0; i < maxPlayers; i++) {
    const player = players.find((p) => p.seat_index === i) || null;
    slots.push(player);
  }

  // Check start readiness: host sees Start Game enabled only if min players present and all non-host players are Ready
  const hasEnoughPlayers = players.length >= maxPlayers;
  const nonHostPlayers = players.filter((p) => !p.is_host && p.seat_index !== 0);
  const allNonHostReady =
    nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.is_ready);
  const canStart = hasEnoughPlayers && allNonHostReady;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between p-4 bg-[#0F172A] text-white">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between pt-2">
        <button
          id="lobby-leave-button"
          onClick={() => {
            sound.playButton();
            setShowLeaveModal(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 transition-all flex items-center gap-1.5 text-xs text-slate-300 font-bold active:scale-95 shadow-md"
        >
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Leave Room
        </button>

        <div className="flex items-center gap-2">
          {isReconnecting ? (
            <span className="text-[11px] text-amber-400 font-bold bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Reconnecting...
            </span>
          ) : isConnected ? (
            <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Connected
            </span>
          ) : (
            <span className="text-[11px] text-rose-400 font-bold bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Offline
            </span>
          )}

          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 border border-blue-500/40 text-blue-300">
            {room.mode === '1v1' ? '1v1 Duel' : '2v2 Clash'}
          </span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="w-full max-w-md flex flex-col gap-4 my-auto py-2">
        {/* Room Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl text-center relative overflow-hidden backdrop-blur-xl"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-500" />
          <p className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-1">
            Room Code
          </p>

          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <span id="lobby-room-code" className="text-4xl font-black font-mono tracking-widest text-amber-400 drop-shadow-[0_2px_10px_rgba(250,204,21,0.3)]">
              {room.code}
            </span>

            {/* Copy Button */}
            <button
              id="lobby-copy-button"
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="p-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 border border-slate-600 text-slate-200 transition-all active:scale-90 flex items-center gap-1 text-xs font-bold"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Share Button */}
            <button
              id="lobby-share-button"
              onClick={handleShare}
              title="Share Room Code"
              className="p-2.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 border border-blue-400/50 text-white transition-all active:scale-90 flex items-center gap-1 text-xs font-bold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share</span>
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-300 mt-1">
            Waiting for players ({players.length}/{maxPlayers})
          </p>
        </motion.div>

        {/* Players Seats */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Player Roster
            </span>
            <span className="text-xs font-bold text-slate-400">
              {players.length}/{maxPlayers} Joined
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {slots.map((player, idx) => {
              if (player) {
                const colorKey = player.color.toUpperCase();
                const colors = COLOR_STYLES[colorKey] || COLOR_STYLES.RED;
                const isCurrentMe =
                  Boolean(me?.id && player.id === me.id) ||
                  Boolean(me?.session_id && player.session_id === me.session_id);
                const isPlayerHost = Boolean(player.is_host || player.seat_index === 0);

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border ${colors.bg} ${colors.border} backdrop-blur-md shadow-sm`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-md text-sm border-2 border-white/20"
                        style={{ backgroundColor: colors.dot }}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-slate-100">{player.name}</span>

                          {/* "You" Badge */}
                          {isCurrentMe && (
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/40 text-blue-200 border border-blue-400/30">
                              You
                            </span>
                          )}

                          {/* "Host" Badge */}
                          {isPlayerHost && (
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400/30">
                              Host
                            </span>
                          )}
                        </div>

                        <span className={`text-[11px] font-semibold ${colors.text} capitalize`}>
                          {player.color} {room.mode === '2v2' ? `• ${player.team === 'teamA' ? 'Team 1' : 'Team 2'}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Live Ready Status on all screens */}
                    <div className="flex items-center gap-2">
                      {isPlayerHost ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 border border-amber-500/40 text-amber-300">
                          Host
                        </span>
                      ) : player.is_ready ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          Ready ✓
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700/60 border border-slate-600 text-slate-400">
                          Not ready
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              }

              // Empty Slot
              return (
                <div
                  key={`empty_${idx}`}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-slate-700/80 bg-slate-800/30 text-slate-500"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-slate-400">
                      {idx + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-400">Open Seat</span>
                      <span className="text-[11px] text-slate-500">Waiting for player...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error notification if start rejected */}
        {errorMessage && (
          <div className="text-center text-xs font-bold text-rose-400 bg-rose-500/20 border border-rose-500/40 p-2.5 rounded-xl">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="w-full max-w-md pb-6 pt-2">
        {isHost ? (
          /* Host Action Area: Start Game button */
          <div className="flex flex-col items-center gap-2">
            {/* Status Hint */}
            <p className="text-xs font-semibold text-slate-400 text-center">
              {!hasEnoughPlayers
                ? `Waiting for all players to join (${players.length}/${maxPlayers})`
                : !allNonHostReady
                ? 'Waiting for all players to be ready'
                : 'All players ready! You can now start the game.'}
            </p>

            <motion.button
              id="lobby-start-button"
              whileHover={canStart ? { scale: 1.02 } : {}}
              whileTap={canStart ? { scale: 0.98 } : {}}
              onClick={handleStartGameClick}
              disabled={!canStart || isStarting}
              className={`w-full py-4 rounded-2xl font-black text-lg tracking-wide shadow-xl flex items-center justify-center gap-2 transition-all ${
                canStart
                  ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_0_25px_rgba(34,197,94,0.4)] border border-emerald-300/40 cursor-pointer animate-pulse'
                  : 'bg-slate-800 border border-slate-700/80 text-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              {isStarting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  STARTING GAME...
                </>
              ) : (
                <>
                  <span>START GAME</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </motion.button>
          </div>
        ) : (
          /* Guest Action Area: I'm Ready / Ready ✓ */
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold text-slate-400 text-center">
              {isMeReady ? 'You are ready! Waiting for host to start the game.' : 'Click below when you are ready to play.'}
            </p>

            <motion.button
              id="lobby-ready-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleToggleReady}
              className={`w-full py-4 rounded-2xl font-black text-base tracking-wide shadow-xl flex items-center justify-center gap-2 transition-all ${
                isMeReady
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/40 border border-emerald-400/40 hover:from-emerald-500 hover:to-teal-500'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/40 border border-blue-400/30'
              }`}
            >
              {isMeReady ? (
                <>
                  <svg className="w-5 h-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Ready ✓ (Click to un-ready)</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>I&apos;m Ready</span>
                </>
              )}
            </motion.button>
          </div>
        )}
      </div>

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl flex flex-col gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Leave Room?</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {isHost
                    ? 'As the room host, leaving now will cancel and close the room for all players.'
                    : 'Are you sure you want to leave this lobby? You will need the room code to rejoin.'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition active:scale-95 border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  id="lobby-confirm-leave-button"
                  onClick={() => {
                    setShowLeaveModal(false);
                    onLeave();
                  }}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition active:scale-95 shadow-lg shadow-rose-900/40"
                >
                  Leave Room
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
