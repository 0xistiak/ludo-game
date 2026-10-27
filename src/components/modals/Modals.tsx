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
  autoMoveEnabled?: boolean;
  onToggleAutoMove?: (enabled: boolean) => void;
  onOpenRules: () => void;
}> = ({
  isOpen,
  onClose,
  soundEnabled,
  onToggleSound,
  autoMoveEnabled = true,
  onToggleAutoMove,
  onOpenRules,
}) => {
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
                {soundEnabled ? 'Synthesized Audio ON' : 'Sound OFF'}
              </div>
            </div>
          </div>
          <button
            type="button"
            id="sound-toggle-button"
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

        {/* Auto-Move toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-700 text-amber-400">
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200">Auto-Move Single Option</div>
              <div className="text-xs text-slate-400">
                {autoMoveEnabled ? 'Auto-move when only one choice (ON)' : 'Manual tap always (OFF)'}
              </div>
            </div>
          </div>
          <button
            type="button"
            id="automove-toggle-button"
            onClick={() => onToggleAutoMove && onToggleAutoMove(!autoMoveEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              autoMoveEnabled ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                autoMoveEnabled ? 'translate-x-6' : 'translate-x-0.5'
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
              <div className="text-xs text-slate-400">Classic Ludo rules & bonus guide</div>
            </div>
          </div>
          <span className="text-slate-400 text-sm">→</span>
        </button>

        <div className="pt-2 text-center text-[11px] text-slate-500">
          PlayWebLudo • Developed by istiak.tech
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
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Classic Ludo Rules">
      <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 text-xs sm:text-sm text-slate-300">
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>🎲</span> Leaving Base & 3 Attempts
          </div>
          <p>
            A token leaves base only on rolling a <strong>6</strong>. When all your tokens are in base (none on the track or in home lane), you get up to <strong>3 roll attempts</strong> in your turn to roll a 6!
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>🔄</span> Rolling a 6 & Bonus Turns
          </div>
          <p>
            Rolling a 6 grants an immediate extra roll. You may choose to bring a token out or advance an existing token. <strong>3 consecutive sixes</strong> cancels the third 6 and passes the turn.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>⚔️</span> Capture & Home Bonus Rolls
          </div>
          <p>
            Capturing an opponent&apos;s token on an unsafe cell sends it back to base yard AND gives you a <strong>bonus roll</strong>! Reaching the center home also awards a <strong>bonus roll</strong>!
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>⭐</span> Safe Cells & Stacks
          </div>
          <p>
            The 4 start cells (➜) and 4 star cells (★) are safe zones where tokens cannot be captured. Same-color tokens can share any cell. Teammates never capture each other.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1">
            <span>🎯</span> Finishing, Winning & 2v2 Teammate Play
          </div>
          <p>
            An exact roll is required to enter center home. In <strong>2v2</strong>, when a player has finished all 4 tokens, on their turn they roll and move their <strong>teammate&apos;s</strong> tokens! The team wins when all 8 tokens reach home.
          </p>
        </div>
      </div>
    </ModalWrapper>
  );
};

export const GameMenuModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onResume: () => void;
  onRequestRestart: () => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onRequestLeave: () => void;
}> = ({
  isOpen,
  onClose,
  onResume,
  onRequestRestart,
  onOpenSettings,
  onOpenRules,
  onRequestLeave,
}) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Game Menu">
      <div className="flex flex-col gap-2.5 w-full">
        {/* Resume */}
        <button
          id="menu-resume-button"
          type="button"
          onClick={onResume}
          className="w-full py-3 px-4 rounded-2xl btn-gold text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition"
        >
          Resume
        </button>

        {/* Restart */}
        <button
          id="menu-restart-button"
          type="button"
          onClick={() => {
            onClose();
            onRequestRestart();
          }}
          className="w-full py-3 px-4 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 text-sm font-bold text-slate-200 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          Restart Match
        </button>

        {/* Settings */}
        <button
          id="menu-settings-button"
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="w-full py-3 px-4 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 text-sm font-bold text-slate-200 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          Settings
        </button>

        {/* Rules */}
        <button
          id="menu-rules-button"
          type="button"
          onClick={() => {
            onClose();
            onOpenRules();
          }}
          className="w-full py-3 px-4 rounded-2xl glass-card border border-slate-700/60 hover:bg-slate-800/80 text-sm font-bold text-slate-200 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          Rules
        </button>

        {/* Leave Game / Home */}
        <button
          id="menu-leave-button"
          type="button"
          onClick={() => {
            onClose();
            onRequestLeave();
          }}
          className="w-full py-3 px-4 rounded-2xl bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition mt-1"
        >
          Leave Game / Home
        </button>
      </div>
    </ModalWrapper>
  );
};

export const ConfirmLeaveModal: React.FC<{
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isOnline?: boolean;
}> = ({ isOpen, onConfirm, onCancel, isOnline }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onCancel} title="Leave Game?">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
          <AlertTriangle size={32} />
        </div>
        <p className="text-sm text-slate-300 mb-6">
          {isOnline
            ? 'Are you sure you want to leave this online match? Your room session will be closed.'
            : 'Are you sure you want to return to Home? Your current local match progress will be cleared.'}
        </p>
        <div className="flex items-center gap-3 w-full">
          <button
            id="cancel-leave-button"
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl glass-card border border-slate-700 font-bold text-sm text-slate-300 hover:text-white transition active:scale-95"
          >
            Stay
          </button>
          <button
            id="confirm-leave-button"
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 font-black text-sm text-white shadow-lg shadow-rose-900/30 active:scale-95 transition"
          >
            Leave Game
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export const PlayerLeftModal: React.FC<{
  isOpen: boolean;
  onHome: () => void;
  onRematch: () => void;
}> = ({ isOpen, onHome, onRematch }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onHome} title="Player Left">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
          <AlertTriangle size={32} />
        </div>
        <h4 className="text-base font-black text-slate-100 mb-1">Match Ended</h4>
        <p className="text-sm text-slate-300 mb-6">
          An opponent has left or abandoned the match.
        </p>
        <div className="flex flex-col gap-2.5 w-full">
          <button
            id="player-left-rematch-button"
            type="button"
            onClick={onRematch}
            className="w-full py-3.5 rounded-2xl btn-blue text-sm font-black uppercase tracking-wider active:scale-95 transition"
          >
            Rematch / New Match
          </button>
          <button
            id="player-left-home-button"
            type="button"
            onClick={onHome}
            className="w-full py-3 rounded-2xl glass-card border border-slate-700/60 font-bold text-sm text-slate-200 hover:bg-slate-800 transition active:scale-95"
          >
            Return to Home
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

