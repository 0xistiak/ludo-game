'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { GameMode, PlayerColor } from '@/engine';
import { sound } from '@/utils/audio';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (mode: GameMode, playerName: string, color: PlayerColor) => Promise<void>;
  defaultName?: string;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  defaultName = 'Player 1',
}) => {
  const [mode, setMode] = useState<GameMode>('1v1');
  const [playerName, setPlayerName] = useState(defaultName);
  const [color, setColor] = useState<PlayerColor>('red');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    sound.playButton();
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate(mode, playerName.trim(), color);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create room';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const colors: Array<{ color: PlayerColor; hex: string; label: string }> = [
    { color: 'red', hex: '#EF4444', label: 'Red' },
    { color: 'green', hex: '#22C55E', label: 'Green' },
    { color: 'yellow', hex: '#FACC15', label: 'Yellow' },
    { color: 'blue', hex: '#3B82F6', label: 'Blue' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl relative text-white"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
            <span>📦</span> Create Online Room
          </h3>
          <button
            id="close-create-room-modal"
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

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Game Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('1v1')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition ${
                  mode === '1v1'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}
              >
                1v1 Duel
              </button>
              <button
                type="button"
                onClick={() => setMode('2v2')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition ${
                  mode === '2v2'
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}
              >
                2v2 Team Battle
              </button>
            </div>
          </div>

          {/* Player Name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              maxLength={16}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-blue-400"
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Your Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((c) => {
                const isSelected = color === c.color;
                return (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setColor(c.color)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                      isSelected
                        ? 'border-white bg-slate-800 scale-105 shadow-md'
                        : 'border-slate-800 bg-slate-800/50 opacity-70'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-300">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl btn-green font-extrabold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Room...
                </>
              ) : (
                'Create Room →'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
