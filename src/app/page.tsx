/**
 * page.tsx
 *
 * Root App Router page managing overall game screen flow and modal states:
 * Home -> Setup -> Gameplay -> Result
 * Matches design/ui-spec.png in screens, layout, buttons, and design tokens.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { GameMode, GameConfig, GameState, createGame, PlayerColor } from '@/engine';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { SetupScreen } from '@/components/screens/SetupScreen';
import { GameplayScreen } from '@/components/screens/GameplayScreen';
import { ResultScreen } from '@/components/screens/ResultScreen';
import {
  ConfirmRestartModal,
  SettingsModal,
  RulesModal,
  NotConfiguredModal,
} from '@/components/modals/Modals';
import { loadPreferences, savePreferences } from '@/utils/storage';
import { sound } from '@/utils/audio';

type Screen = 'home' | 'setup' | 'gameplay' | 'result';

export default function LudoPage() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>(() => {
    return loadPreferences().mode || '1v1';
  });
  const [playerColor] = useState<PlayerColor>(() => {
    return loadPreferences().playerColor || 'red';
  });
  const [playerName] = useState<string>(() => {
    return loadPreferences().playerName || 'Player 1';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return loadPreferences().soundEnabled ?? false;
  });

  // Active game state
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Modal dialog states
  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [notConfiguredFeature, setNotConfiguredFeature] = useState<string | null>(null);

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    sound.setEnabled(enabled);
    savePreferences({ soundEnabled: enabled });
  };

  const handleUpdateGameState = (nextState: GameState) => {
    setGameState(nextState);
    if (nextState.phase === 'game_over' && nextState.winner !== null) {
      // Delay slightly for final move sound and animation
      setTimeout(() => {
        setScreen('result');
      }, 700);
    }
  };

  // Sync external sound manager
  useEffect(() => {
    sound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Support automated test event for deterministic end-to-end verification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleTestWin = () => {
      if (gameState) {
        setGameState({
          ...gameState,
          phase: 'game_over',
          winner: 'red',
        });
      }
      setScreen('result');
    };
    window.addEventListener('test-trigger-win', handleTestWin);
    return () => window.removeEventListener('test-trigger-win', handleTestWin);
  }, [gameState]);

  // Screen navigation handlers
  const handleStartSetup = (mode: GameMode) => {
    setSelectedMode(mode);
    setScreen('setup');
  };

  const handleStartGame = (config: GameConfig) => {
    const game = createGame(config);
    setGameState(game);
    setScreen('gameplay');
  };

  const handlePlayAgain = () => {
    if (!gameState) return;
    const freshGame = createGame(gameState.config);
    setGameState(freshGame);
    setScreen('gameplay');
  };

  const handleConfirmRestart = () => {
    setRestartModalOpen(false);
    if (gameState) {
      const freshGame = createGame(gameState.config);
      setGameState(freshGame);
      setScreen('gameplay');
    } else {
      setScreen('home');
    }
  };

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden flex flex-col items-center justify-center bg-[#0F172A]">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900/60 to-[#0F172A]" />

      {/* Screen Render */}
      <div className="relative w-full h-full max-w-md mx-auto z-10 flex flex-col">
        {screen === 'home' && (
          <HomeScreen
            onStartSetup={handleStartSetup}
            onOpenSettings={() => setSettingsModalOpen(true)}
            onOpenRules={() => setRulesModalOpen(true)}
            onOpenNotConfigured={(f) => setNotConfiguredFeature(f)}
          />
        )}

        {screen === 'setup' && (
          <SetupScreen
            initialMode={selectedMode}
            initialColor={playerColor}
            initialName={playerName}
            onBack={() => setScreen('home')}
            onStartGame={handleStartGame}
            onOpenNotConfigured={(f) => setNotConfiguredFeature(f)}
          />
        )}

        {screen === 'gameplay' && gameState && (
          <GameplayScreen
            gameState={gameState}
            onUpdateState={handleUpdateGameState}
            onRequestRestart={() => setRestartModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
          />
        )}

        {screen === 'result' && gameState && (
          <ResultScreen
            gameState={gameState}
            onPlayAgain={handlePlayAgain}
            onHome={() => setScreen('home')}
            onShare={() => setNotConfiguredFeature('Share Match (Online)')}
          />
        )}
      </div>

      {/* Modal Dialogs */}
      <ConfirmRestartModal
        isOpen={restartModalOpen}
        onConfirm={handleConfirmRestart}
        onCancel={() => setRestartModalOpen(false)}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenRules={() => setRulesModalOpen(true)}
      />

      <RulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />

      <NotConfiguredModal
        isOpen={notConfiguredFeature !== null}
        onClose={() => setNotConfiguredFeature(null)}
        featureName={notConfiguredFeature || undefined}
      />
    </main>
  );
}
