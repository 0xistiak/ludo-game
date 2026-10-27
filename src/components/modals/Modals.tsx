/**
 * Modals.tsx
 *
 * Collection of glassmorphic modal dialogs:
 * - ConfirmRestartModal: Guard against accidental restart during match
 * - SettingsModal: Sound FX toggle and preferences
 * - NotConfiguredModal: Honest Phase 1 placeholder for Phase 2 online features
 * - RulesModal: Visual game rules guide
 */

'use client';

import React from 'react';
import { Volume2, VolumeX, AlertTriangle, X, BookOpen } from 'lucide-react';

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl glass-card p-6 border border-slate-700/60 shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-700/50">
          <h3 className="text-lg font-extrabold text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const ConfirmRestartModal: React.FC<{
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, onConfirm, onCancel }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onCancel} title="Restart Match?">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
          <AlertTriangle size={32} />
        </div>
        <p className="text-sm text-slate-300 mb-6">
          Are you sure you want to restart the current game? Current match progress will be lost.
        </p>
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition"
          >
            Yes, Restart
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export const NotConfiguredModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}> = ({ isOpen, onClose, featureName = 'Online Multiplayer' }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Not Configured Yet">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4 border border-blue-500/30">
          <span className="text-3xl">🌐</span>
        </div>
        <h4 className="text-base font-bold text-slate-100 mb-1">{featureName}</h4>
        <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
          This feature requires the Supabase real-time server architecture, which will be unlocked in{' '}
          <strong className="text-blue-400 font-semibold">Phase 2</strong>.
          <br /><br />
          Full offline local pass-and-play (1v1 & 2v2) is 100% active and playable now!
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl btn-blue text-sm"
        >
          Got It
        </button>
      </div>
    </ModalWrapper>
  );
};

export const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  onOpenRules: () => void;
}> = ({ isOpen, onClose, soundEnabled, onToggleSound, onOpenRules }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-4">
        {/* Sound toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-700 text-blue-400">
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200">Game Sound FX</div>
              <div className="text-xs text-slate-400">
                {soundEnabled ? 'Synthesized Audio ON' : 'Sound OFF (Default)'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleSound(!soundEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              soundEnabled ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Rules button */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenRules();
          }}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-700 text-amber-400">
              <BookOpen size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-200">How to Play</div>
              <div className="text-xs text-slate-400">Rules & movement guide</div>
            </div>
          </div>
          <span className="text-slate-400 text-sm">→</span>
        </button>

        <div className="pt-2 text-center text-[11px] text-slate-500">
          Ludo v1.0 • Developed by istiak.tech
        </div>
      </div>
    </ModalWrapper>
  );
};

export const RulesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Ludo Rules">
      <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 text-xs sm:text-sm text-slate-300">
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>🎲</span> Leaving Base
          </div>
          <p>You must roll an exact <strong>6</strong> to move a pawn from your yard onto your start cell.</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>🔄</span> Extra Turns & 3-Sixes Rule
          </div>
          <p>Rolling a 6 grants an immediate extra roll. However, rolling <strong>3 sixes in a row</strong> forfeits your turn immediately!</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>⚔️</span> Capturing Pawns
          </div>
          <p>Landing on an opponent&apos;s pawn on a normal cell captures it and sends it back to their base yard.</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>⭐</span> Safe Cells
          </div>
          <p>Star cells (★) and Start cells (➜) are safe zones. Pawns on safe cells cannot be captured.</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>🎯</span> Finishing & Winning
          </div>
          <p>An exact roll is required to reach center home. In <strong>1v1</strong>, the first player to get all 4 pawns home wins. In <strong>2v2</strong>, opposite players are teammates; a team wins when all 8 pawns are home.</p>
        </div>
      </div>
    </ModalWrapper>
  );
};
