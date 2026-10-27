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

type Screen = 'home' | 'setup' | 'lobby' | 'gameplay' | 'result';

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

  // Local game state (for offline / pass & play mode)
  const [localGameState, setLocalGameState] = useState<GameState | null>(null);

  // Modal dialog states
  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [notConfiguredFeature, setNotConfiguredFeature] = useState<string | null>(null);
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [joinRoomModalOpen, setJoinRoomModalOpen] = useState(false);

  // Multiplayer Hook
  const {
    room,
    players,
    me,
    isReconnecting,
    createRoom,
    joinRoom,
    toggleReady,
    rollDiceServer,
    makeMoveServer,
    reconnect,
    leaveRoom,
  } = useMultiplayer();

  const isOnline = Boolean(room);

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

  // Try automatic reconnect on initial page load if active room is cached
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cachedCode = localStorage.getItem('ludo_active_room_code');
    if (cachedCode) {
      reconnect(cachedCode).catch(() => {
        localStorage.removeItem('ludo_active_room_code');
      });
    }
  }, [reconnect]);

  // Watch room status transitions
  useEffect(() => {
    if (!room) return;

    if (room.status === 'in_progress' && screen === 'lobby') {
      queueMicrotask(() => setScreen('gameplay'));
    } else if (room.status === 'finished' && screen === 'gameplay') {
      queueMicrotask(() => setScreen('result'));
    }
  }, [room, screen]);

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
      setScreen('result');
    };
    window.addEventListener('test-trigger-win', handleTestWin);
    return () => window.removeEventListener('test-trigger-win', handleTestWin);
  }, [localGameState]);

  // Screen navigation handlers
  const handleStartSetup = (mode: GameMode) => {
    setSelectedMode(mode);
    setScreen('setup');
  };

  const handleStartGame = (config: GameConfig) => {
    const game = createGame(config);
    setLocalGameState(game);
    setScreen('gameplay');
  };

  const handlePlayAgain = () => {
    if (isOnline) {
      setScreen('lobby');
      return;
    }
    if (!localGameState) return;
    const freshGame = createGame(localGameState.config);
    setLocalGameState(freshGame);
    setScreen('gameplay');
  };

  const handleConfirmRestart = () => {
    setRestartModalOpen(false);
    if (isOnline) {
      leaveRoom();
      setScreen('home');
      return;
    }
    if (localGameState) {
      const freshGame = createGame(localGameState.config);
      setLocalGameState(freshGame);
      setScreen('gameplay');
    } else {
      setScreen('home');
    }
  };

  // Create room flow
  const handleCreateRoom = async (mode: GameMode, name: string, color: PlayerColor) => {
    await createRoom(mode, name, color);
    setCreateRoomModalOpen(false);
    setScreen('lobby');
  };

  // Join room flow
  const handleJoinRoom = async (code: string, name: string) => {
    await joinRoom(code, name);
    setJoinRoomModalOpen(false);
    setScreen('lobby');
  };

  const handleLeaveLobby = () => {
    leaveRoom();
    setScreen('home');
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
            onCreateRoom={() => setCreateRoomModalOpen(true)}
            onJoinRoom={() => setJoinRoomModalOpen(true)}
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
            onOpenOnlineModal={() => setCreateRoomModalOpen(true)}
          />
        )}

        {screen === 'lobby' && room && (
          <OnlineLobbyScreen
            room={room}
            players={players}
            me={me}
            onToggleReady={toggleReady}
            onLeave={handleLeaveLobby}
            isReconnecting={isReconnecting}
          />
        )}

        {screen === 'gameplay' && activeGameState && (
          <GameplayScreen
            gameState={activeGameState}
            onUpdateState={(next) => setLocalGameState(next)}
            onRequestRestart={() => setRestartModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            isOnline={isOnline}
            myColor={me?.color}
            roomCode={room?.code}
            isReconnecting={isReconnecting}
            onOnlineRoll={async () => {
              await rollDiceServer();
            }}
            onOnlineMove={async (tokenId) => {
              await makeMoveServer(tokenId);
            }}
          />
        )}

        {screen === 'result' && activeGameState && (
          <ResultScreen
            gameState={activeGameState}
            onPlayAgain={handlePlayAgain}
            onHome={() => {
              if (isOnline) leaveRoom();
              setScreen('home');
            }}
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
