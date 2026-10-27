/**
 * page.tsx
 *
 * Root App Router page managing overall game screen flow and modal states:
 * Home -> Setup / Online Lobby -> Gameplay -> Result
 * Matches design/ui-spec.png in screens, layout, buttons, and design tokens.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { GameMode, GameConfig, GameState, createGame, PlayerColor } from '@/engine';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { SetupScreen } from '@/components/screens/SetupScreen';
import { GameplayScreen } from '@/components/screens/GameplayScreen';
import { ResultScreen } from '@/components/screens/ResultScreen';
import { OnlineLobbyScreen } from '@/components/screens/OnlineLobbyScreen';
import { CreateRoomModal } from '@/components/modals/CreateRoomModal';
import { JoinRoomModal } from '@/components/modals/JoinRoomModal';
import {
  ConfirmRestartModal,
  SettingsModal,
  RulesModal,
  NotConfiguredModal,
} from '@/components/modals/Modals';
import { loadPreferences, savePreferences } from '@/utils/storage';
import { sound } from '@/utils/audio';
import { useMultiplayer } from '@/hooks/useMultiplayer';

type LocalScreen = 'home' | 'setup' | 'gameplay' | 'result';

export default function LudoPage() {
  const [localScreen, setLocalScreen] = useState<LocalScreen>('home');
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
  const [autoMoveEnabled, setAutoMoveEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ludo_auto_move_enabled');
      return stored !== 'false';
    }
    return true;
  });

  const handleToggleAutoMove = (enabled: boolean) => {
    setAutoMoveEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo_auto_move_enabled', enabled ? 'true' : 'false');
    }
  };

  // Local game state (for offline / pass & play mode)
  const [localGameState, setLocalGameState] = useState<GameState | null>(null);

  // Modal dialog states
  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [notConfiguredFeature, setNotConfiguredFeature] = useState<string | null>(null);
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [joinRoomModalOpen, setJoinRoomModalOpen] = useState(false);

  // Unified Multiplayer Hook (all online state, polling, routing, reconnect)
  const {
    room,
    players,
    me,
    isHost,
    onlineScreen,
    isReconnecting,
    isConnected,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    leaveRoom,
    rollDiceServer,
    makeMoveServer,
  } = useMultiplayer();

  const isOnline = Boolean(room && onlineScreen);

  // Active game state: server room state for online mode, localGameState for local play
  const activeGameState: GameState | null = isOnline
    ? (room?.state as GameState) || null
    : localGameState;

  // Sound toggle
  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    sound.setEnabled(enabled);
    savePreferences({ soundEnabled: enabled });
  };

  // Sync external sound manager
  useEffect(() => {
    sound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Support automated test event for deterministic end-to-end verification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleTestWin = () => {
      if (localGameState) {
        setLocalGameState({
          ...localGameState,
          phase: 'game_over',
          winner: 'red',
        });
      }
      setLocalScreen('result');
    };
    window.addEventListener('test-trigger-win', handleTestWin);
    return () => window.removeEventListener('test-trigger-win', handleTestWin);
  }, [localGameState]);

  // Screen navigation handlers
  const handleStartSetup = (mode: GameMode) => {
    setSelectedMode(mode);
    setLocalScreen('setup');
  };

  const handleStartGame = (config: GameConfig) => {
    const game = createGame(config);
    setLocalGameState(game);
    setLocalScreen('gameplay');
  };

  const handlePlayAgain = () => {
    if (isOnline) {
      leaveRoom();
      setLocalScreen('home');
      return;
    }
    if (!localGameState) return;
    const freshGame = createGame(localGameState.config);
    setLocalGameState(freshGame);
    setLocalScreen('gameplay');
  };

  const handleConfirmRestart = () => {
    setRestartModalOpen(false);
    if (isOnline) {
      leaveRoom();
      setLocalScreen('home');
      return;
    }
    if (localGameState) {
      const freshGame = createGame(localGameState.config);
      setLocalGameState(freshGame);
      setLocalScreen('gameplay');
    } else {
      setLocalScreen('home');
    }
  };

  // Create room flow
  const handleCreateRoom = async (mode: GameMode, name: string, color: PlayerColor) => {
    try {
      await createRoom(mode, name, color);
      setCreateRoomModalOpen(false);
    } catch (err: unknown) {
      console.error('Failed to create room:', err);
    }
  };

  // Join room flow
  const handleJoinRoom = async (code: string, name: string) => {
    try {
      await joinRoom(code, name);
      setJoinRoomModalOpen(false);
    } catch (err: unknown) {
      console.error('Failed to join room:', err);
    }
  };

  const handleLeaveOnline = () => {
    leaveRoom();
    setLocalScreen('home');
  };

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden flex flex-col items-center justify-center bg-[#0F172A]">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900/60 to-[#0F172A]" />

      {/* Screen Render */}
      <div className="relative w-full h-full max-w-md mx-auto z-10 flex flex-col">
        {/* ONLINE SCREENS (driven directly and synchronously by useMultiplayer room state) */}
        {isOnline && onlineScreen === 'lobby' && room && (
          <OnlineLobbyScreen
            room={room}
            players={players}
            me={me}
            isHost={isHost}
            onToggleReady={toggleReady}
            onStartGame={startGame}
            onLeave={handleLeaveOnline}
            isReconnecting={isReconnecting}
            isConnected={isConnected}
          />
        )}

        {isOnline && onlineScreen === 'gameplay' && activeGameState && (
          <GameplayScreen
            gameState={activeGameState}
            onUpdateState={(next) => setLocalGameState(next)}
            onRequestRestart={() => setRestartModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            autoMoveEnabled={autoMoveEnabled}
            isOnline={true}
            myColor={me?.color}
            roomCode={room?.code}
            isReconnecting={isReconnecting}
            isConnected={isConnected}
            onlinePlayers={players}
            onOnlineRoll={async () => {
              await rollDiceServer();
            }}
            onOnlineMove={async (tokenId) => {
              await makeMoveServer(tokenId);
            }}
          />
        )}

        {isOnline && onlineScreen === 'result' && activeGameState && (
          <ResultScreen
            gameState={activeGameState}
            onPlayAgain={handlePlayAgain}
            onHome={handleLeaveOnline}
            onShare={() => setNotConfiguredFeature('Share Match (Online)')}
          />
        )}

        {/* OFFLINE / PASS & PLAY SCREENS */}
        {!isOnline && localScreen === 'home' && (
          <HomeScreen
            onStartSetup={handleStartSetup}
            onOpenSettings={() => setSettingsModalOpen(true)}
            onOpenRules={() => setRulesModalOpen(true)}
            onOpenNotConfigured={(f) => setNotConfiguredFeature(f)}
            onCreateRoom={() => setCreateRoomModalOpen(true)}
            onJoinRoom={() => setJoinRoomModalOpen(true)}
          />
        )}

        {!isOnline && localScreen === 'setup' && (
          <SetupScreen
            initialMode={selectedMode}
            initialColor={playerColor}
            initialName={playerName}
            onBack={() => setLocalScreen('home')}
            onStartGame={handleStartGame}
            onOpenNotConfigured={(f) => setNotConfiguredFeature(f)}
            onOpenOnlineModal={() => setCreateRoomModalOpen(true)}
          />
        )}

        {!isOnline && localScreen === 'gameplay' && activeGameState && (
          <GameplayScreen
            gameState={activeGameState}
            onUpdateState={(next) => setLocalGameState(next)}
            onRequestRestart={() => setRestartModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            autoMoveEnabled={autoMoveEnabled}
            isOnline={false}
          />
        )}

        {!isOnline && localScreen === 'result' && activeGameState && (
          <ResultScreen
            gameState={activeGameState}
            onPlayAgain={handlePlayAgain}
            onHome={() => setLocalScreen('home')}
            onShare={() => setNotConfiguredFeature('Share Match (Local)')}
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
        autoMoveEnabled={autoMoveEnabled}
        onToggleAutoMove={handleToggleAutoMove}
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

      <CreateRoomModal
        isOpen={createRoomModalOpen}
        onClose={() => setCreateRoomModalOpen(false)}
        onCreate={handleCreateRoom}
        defaultName={playerName}
      />

      <JoinRoomModal
        isOpen={joinRoomModalOpen}
        onClose={() => setJoinRoomModalOpen(false)}
        onJoin={handleJoinRoom}
        defaultName="Player 2"
      />
    </main>
  );
}
