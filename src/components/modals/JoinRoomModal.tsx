'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { sound } from '@/utils/audio';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomCode: string, playerName: string) => Promise<void>;
  defaultName?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoin,
  defaultName = 'Player 2',
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState(defaultName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (sanitized.length !== 6) {
      setError('Please enter a valid 6-digit room code');
      return;
    }
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    sound.playButton();
    setIsSubmitting(true);
    setError(null);
    try {
      await onJoin(sanitized, playerName.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join room. Please check the code.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl bg-slate-900 border border-slate-700/80 p-5 sm:p-6 shadow-2xl relative text-white overflow-hidden"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
            <span>🪙</span> Join Online Room
          </h3>
          <button
            id="close-join-room-modal"
            type="button"
            aria-label="Close modal"
            onClick={() => {
              sound.playButton();
              onClose();
            }}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pt-3 pr-0.5">
            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Room Code */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                6-Digit Room Code
              </label>
              <input
                id="join-room-code-input"
                type="text"
                inputMode="numeric"
                value={roomCode}
                maxLength={6}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-xl font-mono font-black text-amber-400 tracking-widest text-center focus:outline-none focus:border-amber-400 uppercase placeholder:text-slate-600 placeholder:text-sm placeholder:font-sans placeholder:tracking-normal"
                placeholder="e.g. 426153"
                required
                autoFocus
              />
            </div>

            {/* Player Name */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Your Name
              </label>
              <input
                id="join-player-name-input"
                type="text"
                value={playerName}
                maxLength={16}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-blue-400"
                placeholder="Enter your name"
                required
              />
            </div>
          </div>

          <div className="pt-2 shrink-0">
            <button
              id="submit-join-room-button"
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[50px] min-h-[50px] rounded-2xl btn-gold font-extrabold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  Joining Room...
                </>
              ) : (
                'Join Room →'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
