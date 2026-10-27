'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RoomRow, RoomPlayerRow } from '@/types/multiplayer';
import { sound } from '@/utils/audio';

interface OnlineLobbyScreenProps {
  room: RoomRow;
  players: RoomPlayerRow[];
  me: RoomPlayerRow | null;
  onToggleReady: (ready: boolean) => void;
  onLeave: () => void;
  isReconnecting?: boolean;
}

const COLOR_STYLES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  RED: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
    glow: 'rgba(239, 68, 68, 0.4)',
  },
  GREEN: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
    glow: 'rgba(34, 197, 94, 0.4)',
  },
  YELLOW: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    glow: 'rgba(250, 204, 21, 0.4)',
  },
  BLUE: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    glow: 'rgba(30, 64, 175, 0.4)',
  },
};

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({
  room,
  players,
  me,
  onToggleReady,
  onLeave,
  isReconnecting,
}) => {
  const [copied, setCopied] = useState(false);
  const maxPlayers = room.mode === '1v1' ? 2 : 4;
  const isMeReady = me?.is_ready ?? false;

  const handleCopyCode = () => {
    sound.playButton();
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = () => {
    sound.playButton();
    onToggleReady(!isMeReady);
  };

  // Build fixed slots for 1v1 (2 slots) or 2v2 (4 slots)
  const slots: (RoomPlayerRow | null)[] = [];
  for (let i = 0; i < maxPlayers; i++) {
    const player = players.find((p) => p.seat_index === i) || null;
    slots.push(player);
  }

  const allReady = players.length === maxPlayers && players.every((p) => p.is_ready);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between p-4 bg-[#0F172A] text-white">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between pt-2">
        <button
          onClick={() => {
            sound.playButton();
            onLeave();
          }}
          className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80 transition-all flex items-center gap-1.5 text-xs text-slate-300 font-semibold active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Leave
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 border border-blue-500/40 text-blue-300">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            {room.mode === '1v1' ? '1v1 Duel' : '2v2 Team Clash'}
          </span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="w-full max-w-md flex flex-col gap-5 my-auto py-4">
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
          <div className="flex items-center justify-center gap-3 my-1">
            <span className="text-4xl font-black font-mono tracking-widest text-amber-400 drop-shadow-[0_2px_10px_rgba(250,204,21,0.3)]">
              {room.code}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 border border-slate-600 text-slate-200 transition-all active:scale-90"
            >
              {copied ? (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Share this 6-character code with friends to join!
          </p>
        </motion.div>

        {/* Players Seats */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Players ({players.length}/{maxPlayers})
            </span>
            {isReconnecting && (
              <span className="text-[11px] text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Reconnecting...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {slots.map((player, idx) => {
              if (player) {
                const colorKey = player.color.toUpperCase();
                const colors = COLOR_STYLES[colorKey] || COLOR_STYLES.RED;
                const isCurrentMe = player.session_id === me?.session_id;

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border ${colors.bg} ${colors.border} backdrop-blur-md`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md text-sm border-2 border-white/20"
                        style={{
                          backgroundColor:
                            player.color.toLowerCase() === 'red'
                              ? '#EF4444'
                              : player.color.toLowerCase() === 'green'
                              ? '#22C55E'
                              : player.color.toLowerCase() === 'yellow'
                              ? '#EAB308'
                              : '#3B82F6',
                        }}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-100">{player.name}</span>
                          {isCurrentMe && (
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/40 text-blue-200">
                              You
                            </span>
                          )}
                          {player.session_id === room.host_id && (
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300">
                              Host
                            </span>
                          )}
                        </div>
                        <span className={`text-[11px] font-semibold ${colors.text}`}>
                          {player.color} {room.mode === '2v2' ? `• ${player.team === 'teamA' ? 'Team 1' : 'Team 2'}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {player.is_ready ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          READY
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700/60 border border-slate-600 text-slate-400">
                          WAITING
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
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-xs font-mono">
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

        {/* Lobby Status Hint */}
        <div className="text-center text-xs text-slate-400 py-1">
          {players.length < maxPlayers ? (
            <span>Waiting for {maxPlayers - players.length} more player(s) to join...</span>
          ) : allReady ? (
            <span className="text-emerald-400 font-bold animate-pulse">
              All players ready! Starting game...
            </span>
          ) : (
            <span>Waiting for all players to click READY...</span>
          )}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="w-full max-w-md pb-6 pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleToggle}
          disabled={allReady}
          className={`w-full py-4 rounded-2xl font-extrabold text-base tracking-wide shadow-xl flex items-center justify-center gap-2 transition-all ${
            isMeReady
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/40 border border-emerald-400/30'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/40 border border-blue-400/30'
          }`}
        >
          {isMeReady ? (
            <>
              <svg className="w-5 h-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              YOU ARE READY (CLICK TO CANCEL)
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              CLICK WHEN READY
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
