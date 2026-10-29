/**
 * LudoBoard.tsx
 *
 * Full SVG implementation of the 15x15 Ludo board matching design/ui-spec.png.
 * 100% vector drawn, responsive, zero external images.
 * Features:
 * - Step-by-step hop along lastMove.path (110-140ms per step, <= 1.2s total)
 * - Hop bounce, scale, and dynamic drop shadows
 * - Base exit pop & slide, capture flash & flyback, home sparkle
 * - Prefers-reduced-motion support (instant jump)
 * - Brief highlight of last move's start and end cells
 * - Tapping any base token or base area brings a token out when base-exit is legal
 */

'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  PlayerColor,
  GameState,
  START_CELLS,
  STAR_CELLS,
  STEP_BASE,
} from '@/engine';
import {
  BOARD_SIZE,
  CELL_SIZE,
  TRACK_CELL_GRID,
  HOME_LANES_GRID,
  BASE_SPOTS,
  getTokenCoord,
  Coord,
} from './boardLayout';
import { TokenSvg } from './TokenSvg';
import { sound } from '@/utils/audio';

interface LudoBoardProps {
  gameState: GameState;
  onSelectToken: (tokenId: string) => void;
  className?: string;
  onAnimationStateChange?: (isAnimating: boolean) => void;
}

export const LudoBoard: React.FC<LudoBoardProps> = ({
  gameState,
  onSelectToken,
  className = '',
  onAnimationStateChange,
}) => {
  const { tokens, legalMoves, lastMove, turnCount } = gameState;

  // Animation state: moving token visual in flight (60/120fps continuous rAF)
  const [movingToken, setMovingToken] = useState<{
    tokenId: string;
    color: PlayerColor;
    tokenIndex: number;
    x: number;
    y: number;
    scale: number;
    shadowX: number;
    shadowY: number;
    shadowRx: number;
    shadowRy: number;
    shadowOpacity: number;
  } | null>(null);

  const [highlightCells, setHighlightCells] = useState<{
    fromCoord: Coord | null;
    toCoord: Coord | null;
  } | null>(null);

  const [sparkleCoord, setSparkleCoord] = useState<Coord | null>(null);
  const [capturedFlash, setCapturedFlash] = useState<{
    tokenIds: string[];
    coord: Coord;
  } | null>(null);

  // Track last handled move to avoid replaying on initial load/refresh
  const currentMoveKey = lastMove ? `${turnCount}_${lastMove.tokenId}_${lastMove.from}_${lastMove.to}` : null;
  const [handledMoveKey, setHandledMoveKey] = useState<string | null>(currentMoveKey);

  // Active base exit eligibility
  const activeColor = gameState.currentPlayer || gameState.players[gameState.activePlayerIndex]?.color;
  const legalBaseTokenId = useMemo(() => {
    return legalMoves.find((id) => {
      const t = tokens[id];
      return t && t.color === activeColor && t.step === STEP_BASE;
    });
  }, [legalMoves, tokens, activeColor]);

  // Handle lastMove with smooth continuous 60fps hop-arc movement
  useEffect(() => {
    if (!lastMove || !currentMoveKey) return;

    if (handledMoveKey === currentMoveKey) {
      return;
    }

    const token = tokens[lastMove.tokenId];
    if (!token) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const fromCoord = getTokenCoord(token.color, lastMove.from, token.index);
    const toCoord = getTokenCoord(token.color, lastMove.to, token.index);

    // Show highlight on start and destination cells briefly (~1.2s)
    queueMicrotask(() => {
      setHighlightCells({ fromCoord, toCoord });
    });
    const highlightTimer = setTimeout(() => {
      setHighlightCells(null);
    }, 1200);

    if (prefersReducedMotion) {
      queueMicrotask(() => {
        setHandledMoveKey(currentMoveKey);
      });
      return () => clearTimeout(highlightTimer);
    }

    // Build waypoints array along path
    let waypoints: Coord[] = [];
    if (lastMove.path && lastMove.path.length > 1) {
      waypoints = lastMove.path.map((step) =>
        getTokenCoord(token.color, step, token.index)
      );
    } else {
      waypoints = [fromCoord, toCoord];
    }

    const hopCount = waypoints.length - 1;
    if (hopCount <= 0) {
      queueMicrotask(() => {
        setHandledMoveKey(currentMoveKey);
      });
      return () => clearTimeout(highlightTimer);
    }

    onAnimationStateChange?.(true);

    const isBaseExit = lastMove.from === STEP_BASE;
    if (isBaseExit) {
      sound.playBaseExit();
    }

    // Dynamic duration: snappy hops (~110ms-130ms per step, ~280ms for base exit)
    const stepDuration = isBaseExit ? 280 : Math.max(105, Math.min(140, Math.floor(750 / hopCount)));
    const totalDuration = hopCount * stepDuration;

    let rafId: number | null = null;
    let startTime: number | null = null;
    let lastPlayedHop = -1;

    const animateFrame = (now: number) => {
      if (startTime === null) {
        startTime = now;
      }
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalDuration);

      if (progress >= 1) {
        // Animation finished at destination
        setMovingToken(null);
        setHandledMoveKey(currentMoveKey);

        // Sound & celebratory effects at landing
        if (lastMove.capturedTokenIds && lastMove.capturedTokenIds.length > 0) {
          sound.playCapture();
          setCapturedFlash({
            tokenIds: lastMove.capturedTokenIds,
            coord: toCoord,
          });
          setTimeout(() => {
            setCapturedFlash(null);
            onAnimationStateChange?.(false);
          }, 240);
        } else if (lastMove.reachedHome) {
          sound.playHomeFinish();
          setSparkleCoord(toCoord);
          setTimeout(() => {
            setSparkleCoord(null);
            onAnimationStateChange?.(false);
          }, 350);
        } else {
          onAnimationStateChange?.(false);
        }
        return;
      }

      // Determine current hop segment [k, k+1]
      const totalProg = progress * hopCount;
      const k = Math.min(hopCount - 1, Math.floor(totalProg));
      const segT = totalProg - k; // 0..1 within this hop

      // Play step sound on entry to each hop segment (except base exit which already played)
      if (k > lastPlayedHop && !isBaseExit) {
        lastPlayedHop = k;
        sound.playTokenStep(k + 1);
      }

      const p0 = waypoints[k];
      const p1 = waypoints[k + 1];

      // Smooth horizontal easing: cosine ease-in-out
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * segT);
      const groundX = p0.x + (p1.x - p0.x) * ease;
      const groundY = p0.y + (p1.y - p0.y) * ease;

      // Parabolic vertical hop arc (sine curve)
      const arcHeight = isBaseExit ? 26 : 16;
      const arcFactor = Math.sin(Math.PI * segT);
      const liftY = -arcHeight * arcFactor;
      const currentY = groundY + liftY;

      // 3D scale expansion at apex
      const scale = 1.0 + (isBaseExit ? 0.28 : 0.22) * arcFactor;

      // Dynamic ground shadow that diffuses and shrinks as token rises
      const shadowRx = 13 - 4 * arcFactor;
      const shadowRy = 6 - 2 * arcFactor;
      const shadowOpacity = 0.40 - 0.22 * arcFactor;

      setMovingToken({
        tokenId: lastMove.tokenId,
        color: token.color,
        tokenIndex: token.index,
        x: groundX,
        y: currentY,
        scale,
        shadowX: groundX,
        shadowY: groundY + 5,
        shadowRx,
        shadowRy,
        shadowOpacity,
      });

      rafId = requestAnimationFrame(animateFrame);
    };

    rafId = requestAnimationFrame(animateFrame);

    // Safety timeout: animation must NEVER block longer than 1.6s
    const safetyTimeout = setTimeout(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setMovingToken(null);
      setHandledMoveKey(currentMoveKey);
      setCapturedFlash(null);
      setSparkleCoord(null);
      onAnimationStateChange?.(false);
    }, 1600);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      clearTimeout(highlightTimer);
      clearTimeout(safetyTimeout);
      setMovingToken(null);
      onAnimationStateChange?.(false);
    };
  }, [lastMove, turnCount, tokens, onAnimationStateChange, currentMoveKey, handledMoveKey]);

  // Handle 3 consecutive 6s turn cancellation and token slide-back
  const [revertingActive, setRevertingActive] = useState<boolean>(false);
  const lastHandledRevertKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gameState.revertedTurn) return;
    const { turnCount: revTurn, revertedTokens } = gameState.revertedTurn;
    if (revTurn === lastHandledRevertKeyRef.current || !revertedTokens || revertedTokens.length === 0) return;
    lastHandledRevertKeyRef.current = revTurn;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    let timer: NodeJS.Timeout | null = null;
    const startTimer = setTimeout(() => {
      onAnimationStateChange?.(true);
      setRevertingActive(true);

      timer = setTimeout(() => {
        setRevertingActive(false);
        onAnimationStateChange?.(false);
      }, 600);
    }, 0);

    return () => {
      clearTimeout(startTimer);
      if (timer) clearTimeout(timer);
      onAnimationStateChange?.(false);
    };
  }, [gameState.revertedTurn, onAnimationStateChange]);

  // Group tokens by their rendered SVG coordinate to spread stacked tokens
  const tokenCoords = useMemo(() => {
    const map = new Map<string, { coord: Coord; isLegal: boolean; color: PlayerColor }>();
    const posCounts = new Map<string, number>();

    // First pass: compute coords (omitting the actively moving token)
    for (const [id, token] of Object.entries(tokens)) {
      // If this token is currently in flight via movingToken, omit from static map
      if (movingToken && movingToken.tokenId === id) {
        continue;
      }

      let stepToRender = token.step;
      // If a move just arrived but animation hasn't started yet, don't flash at destination
      if (lastMove && lastMove.tokenId === id && currentMoveKey && handledMoveKey !== currentMoveKey) {
        stepToRender = lastMove.from;
      }

      const coord = getTokenCoord(token.color, stepToRender, token.index);
      const isLegal =
        legalMoves.includes(id) ||
        (Boolean(legalBaseTokenId) && token.color === activeColor && token.step === STEP_BASE);
      map.set(id, { coord, isLegal, color: token.color });

      const key = `${Math.round(coord.x)},${Math.round(coord.y)}`;
      posCounts.set(key, (posCounts.get(key) || 0) + 1);
    }

    // Second pass: apply slight offset if more than 1 token on exact same spot
    const posCurrentIndex = new Map<string, number>();
    const finalMap = new Map<string, { coord: Coord; isLegal: boolean; color: PlayerColor }>();

    for (const [id, entry] of map.entries()) {
      const key = `${Math.round(entry.coord.x)},${Math.round(entry.coord.y)}`;
      const total = posCounts.get(key) || 1;
      const index = posCurrentIndex.get(key) || 0;
      posCurrentIndex.set(key, index + 1);

      if (total > 1) {
        // Offset in a small cluster circle
        const angle = (index / total) * Math.PI * 2;
        const radius = Math.min(10, 4 + total * 2);
        finalMap.set(id, {
          ...entry,
          coord: {
            x: entry.coord.x + Math.cos(angle) * radius,
            y: entry.coord.y + Math.sin(angle) * radius,
          },
        });
      } else {
        finalMap.set(id, entry);
      }
    }

    return finalMap;
  }, [tokens, legalMoves, legalBaseTokenId, activeColor, movingToken, lastMove, handledMoveKey, currentMoveKey]);

  // Handle click on base yard directly
  const handleBaseYardClick = (color: PlayerColor) => {
    if (color === activeColor && legalBaseTokenId) {
      onSelectToken(legalBaseTokenId);
    }
  };

  return (
    <div
      className={`relative w-full aspect-square max-w-[500px] mx-auto select-none p-1 rounded-2xl glass-panel shadow-2xl flex items-center justify-center ${className}`}
    >
      <svg
        viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
        className="w-full h-full rounded-xl overflow-hidden shadow-inner"
        style={{ background: '#0F172A' }}
      >
        <defs>
          {/* Base corner gradients */}
          <radialGradient id="base-red-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#991B1B" />
          </radialGradient>
          <radialGradient id="base-green-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#166534" />
          </radialGradient>
          <radialGradient id="base-yellow-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#A16207" />
          </radialGradient>
          <radialGradient id="base-blue-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </radialGradient>

          {/* Cell gradients */}
          <linearGradient id="normal-cell-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>

          <linearGradient id="safe-cell-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          {/* Shadow filters */}
          <filter id="board-cell-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#000000" floodOpacity="0.2" />
          </filter>

          <filter id="hop-shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="8" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* 1. Base Corner: Red */}
        <g
          id="base-red"
          onClick={() => handleBaseYardClick('red')}
          className={activeColor === 'red' && legalBaseTokenId ? 'cursor-pointer' : ''}
        >
          <rect x="0" y="0" width="240" height="240" fill="url(#base-red-grad)" stroke="#1E293B" strokeWidth="2" rx="16" />
          <rect
            x="36"
            y="36"
            width="168"
            height="168"
            fill="#1E293B"
            rx="14"
            opacity={activeColor === 'red' && legalBaseTokenId ? 0.6 : 0.4}
            className={activeColor === 'red' && legalBaseTokenId ? 'animate-pulse' : ''}
          />
          {BASE_SPOTS.red.map((spot, i) => (
            <g key={`spot-red-${i}`}>
              <circle cx={spot.x} cy={spot.y} r="22" fill="#0F172A" stroke="#EF4444" strokeWidth="3" opacity="0.8" />
              <circle cx={spot.x} cy={spot.y} r="16" fill="#EF4444" opacity="0.3" />
            </g>
          ))}
        </g>

        {/* 2. Base Corner: Green */}
        <g
          id="base-green"
          onClick={() => handleBaseYardClick('green')}
          className={activeColor === 'green' && legalBaseTokenId ? 'cursor-pointer' : ''}
        >
          <rect x="360" y="0" width="240" height="240" fill="url(#base-green-grad)" stroke="#1E293B" strokeWidth="2" rx="16" />
          <rect
            x="396"
            y="36"
            width="168"
            height="168"
            fill="#1E293B"
            rx="14"
            opacity={activeColor === 'green' && legalBaseTokenId ? 0.6 : 0.4}
            className={activeColor === 'green' && legalBaseTokenId ? 'animate-pulse' : ''}
          />
          {BASE_SPOTS.green.map((spot, i) => (
            <g key={`spot-green-${i}`}>
              <circle cx={spot.x} cy={spot.y} r="22" fill="#0F172A" stroke="#22C55E" strokeWidth="3" opacity="0.8" />
              <circle cx={spot.x} cy={spot.y} r="16" fill="#22C55E" opacity="0.3" />
            </g>
          ))}
        </g>

        {/* 3. Base Corner: Yellow */}
        <g
          id="base-yellow"
          onClick={() => handleBaseYardClick('yellow')}
          className={activeColor === 'yellow' && legalBaseTokenId ? 'cursor-pointer' : ''}
        >
          <rect x="360" y="360" width="240" height="240" fill="url(#base-yellow-grad)" stroke="#1E293B" strokeWidth="2" rx="16" />
          <rect
            x="396"
            y="396"
            width="168"
            height="168"
            fill="#1E293B"
            rx="14"
            opacity={activeColor === 'yellow' && legalBaseTokenId ? 0.6 : 0.4}
            className={activeColor === 'yellow' && legalBaseTokenId ? 'animate-pulse' : ''}
          />
          {BASE_SPOTS.yellow.map((spot, i) => (
            <g key={`spot-yellow-${i}`}>
              <circle cx={spot.x} cy={spot.y} r="22" fill="#0F172A" stroke="#FACC15" strokeWidth="3" opacity="0.8" />
              <circle cx={spot.x} cy={spot.y} r="16" fill="#FACC15" opacity="0.3" />
            </g>
          ))}
        </g>

        {/* 4. Base Corner: Blue */}
        <g
          id="base-blue"
          onClick={() => handleBaseYardClick('blue')}
          className={activeColor === 'blue' && legalBaseTokenId ? 'cursor-pointer' : ''}
        >
          <rect x="0" y="360" width="240" height="240" fill="url(#base-blue-grad)" stroke="#1E293B" strokeWidth="2" rx="16" />
          <rect
            x="36"
            y="396"
            width="168"
            height="168"
            fill="#1E293B"
            rx="14"
            opacity={activeColor === 'blue' && legalBaseTokenId ? 0.6 : 0.4}
            className={activeColor === 'blue' && legalBaseTokenId ? 'animate-pulse' : ''}
          />
          {BASE_SPOTS.blue.map((spot, i) => (
            <g key={`spot-blue-${i}`}>
              <circle cx={spot.x} cy={spot.y} r="22" fill="#0F172A" stroke="#3B82F6" strokeWidth="3" opacity="0.8" />
              <circle cx={spot.x} cy={spot.y} r="16" fill="#3B82F6" opacity="0.3" />
            </g>
          ))}
        </g>

        {/* 5. Shared Track Cells (52 cells) */}
        <g id="track-cells">
          {TRACK_CELL_GRID.map((cell, idx) => {
            const x = cell.col * CELL_SIZE;
            const y = cell.row * CELL_SIZE;
            const isStar = STAR_CELLS.includes(idx);
            const isRedStart = idx === START_CELLS.red;
            const isGreenStart = idx === START_CELLS.green;
            const isYellowStart = idx === START_CELLS.yellow;
            const isBlueStart = idx === START_CELLS.blue;

            let cellFill = 'url(#normal-cell-grad)';
            let cellStroke = '#CBD5E1';
            if (isStar) {
              cellFill = 'url(#safe-cell-grad)';
              cellStroke = '#60A5FA';
            } else if (isRedStart) {
              cellFill = '#EF4444';
              cellStroke = '#B91C1C';
            } else if (isGreenStart) {
              cellFill = '#22C55E';
              cellStroke = '#15803D';
            } else if (isYellowStart) {
              cellFill = '#FACC15';
              cellStroke = '#CA8A04';
            } else if (isBlueStart) {
              cellFill = '#3B82F6';
              cellStroke = '#1D4ED8';
            }

            return (
              <g key={`track-cell-${idx}`}>
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={CELL_SIZE - 2}
                  height={CELL_SIZE - 2}
                  fill={cellFill}
                  stroke={cellStroke}
                  strokeWidth="1.2"
                  rx="4"
                  filter="url(#board-cell-shadow)"
                />

                {/* Safe Star Icon on Star Cells */}
                {isStar && (
                  <path
                    d={`M ${x + 20} ${y + 9} 
                        L ${x + 23} ${y + 16} 
                        L ${x + 31} ${y + 17} 
                        L ${x + 25} ${y + 23} 
                        L ${x + 27} ${y + 31} 
                        L ${x + 20} ${y + 26} 
                        L ${x + 13} ${y + 31} 
                        L ${x + 15} ${y + 23} 
                        L ${x + 9} ${y + 17} 
                        L ${x + 17} ${y + 16} Z`}
                    fill="#FDE047"
                    stroke="#FFFFFF"
                    strokeWidth="0.8"
                    style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
                  />
                )}

                {/* Direction Arrows on Start Cells */}
                {isRedStart && (
                  <path
                    d={`M ${x + 14} ${y + 13} L ${x + 27} ${y + 20} L ${x + 14} ${y + 27}`}
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
                {isGreenStart && (
                  <path
                    d={`M ${x + 13} ${y + 14} L ${x + 20} ${y + 27} L ${x + 27} ${y + 14}`}
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
                {isYellowStart && (
                  <path
                    d={`M ${x + 26} ${y + 13} L ${x + 13} ${y + 20} L ${x + 26} ${y + 27}`}
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
                {isBlueStart && (
                  <path
                    d={`M ${x + 13} ${y + 26} L ${x + 20} ${y + 13} L ${x + 27} ${y + 26}`}
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* 6. Home Lanes (5 cells per color) */}
        <g id="home-lanes">
          {HOME_LANES_GRID.red.map((cell, idx) => (
            <rect
              key={`home-red-${idx}`}
              x={cell.col * CELL_SIZE + 1}
              y={cell.row * CELL_SIZE + 1}
              width={CELL_SIZE - 2}
              height={CELL_SIZE - 2}
              fill="#EF4444"
              stroke="#B91C1C"
              strokeWidth="1.2"
              rx="4"
            />
          ))}
          {HOME_LANES_GRID.green.map((cell, idx) => (
            <rect
              key={`home-green-${idx}`}
              x={cell.col * CELL_SIZE + 1}
              y={cell.row * CELL_SIZE + 1}
              width={CELL_SIZE - 2}
              height={CELL_SIZE - 2}
              fill="#22C55E"
              stroke="#15803D"
              strokeWidth="1.2"
              rx="4"
            />
          ))}
          {HOME_LANES_GRID.yellow.map((cell, idx) => (
            <rect
              key={`home-yellow-${idx}`}
              x={cell.col * CELL_SIZE + 1}
              y={cell.row * CELL_SIZE + 1}
              width={CELL_SIZE - 2}
              height={CELL_SIZE - 2}
              fill="#FACC15"
              stroke="#CA8A04"
              strokeWidth="1.2"
              rx="4"
            />
          ))}
          {HOME_LANES_GRID.blue.map((cell, idx) => (
            <rect
              key={`home-blue-${idx}`}
              x={cell.col * CELL_SIZE + 1}
              y={cell.row * CELL_SIZE + 1}
              width={CELL_SIZE - 2}
              height={CELL_SIZE - 2}
              fill="#3B82F6"
              stroke="#1D4ED8"
              strokeWidth="1.2"
              rx="4"
            />
          ))}
        </g>

        {/* 7. Center Home Triangles */}
        <g id="center-home">
          <polygon points="240,240 300,300 240,360" fill="#EF4444" stroke="#1E293B" strokeWidth="1" />
          <polygon points="240,240 300,300 360,240" fill="#22C55E" stroke="#1E293B" strokeWidth="1" />
          <polygon points="360,240 300,300 360,360" fill="#FACC15" stroke="#1E293B" strokeWidth="1" />
          <polygon points="240,360 300,300 360,360" fill="#3B82F6" stroke="#1E293B" strokeWidth="1" />
          <circle cx="300" cy="300" r="16" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.8))' }} />
          <polygon
            points="300,288 304,297 313,298 306,304 308,313 300,308 292,313 294,304 287,298 296,297"
            fill="#FFFFFF"
          />
        </g>

        {/* Highlight start & end cells of last move */}
        {highlightCells && (
          <g id="move-highlights">
            {highlightCells.fromCoord && (
              <circle
                cx={highlightCells.fromCoord.x}
                cy={highlightCells.fromCoord.y}
                r="18"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="2.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />
            )}
            {highlightCells.toCoord && (
              <circle
                cx={highlightCells.toCoord.x}
                cy={highlightCells.toCoord.y}
                r="20"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3"
                className="animate-ping"
                opacity="0.75"
              />
            )}
          </g>
        )}

        {/* Capture flash effect */}
        {capturedFlash && (
          <circle
            cx={capturedFlash.coord.x}
            cy={capturedFlash.coord.y}
            r="24"
            fill="#EF4444"
            opacity="0.75"
            className="animate-ping"
          />
        )}

        {/* Home sparkle celebration effect */}
        {sparkleCoord && (
          <g transform={`translate(${sparkleCoord.x}, ${sparkleCoord.y})`}>
            <circle cx="0" cy="0" r="26" fill="#F59E0B" opacity="0.6" className="animate-ping" />
            <polygon
              points="0,-18 5,-5 18,0 5,5 0,18 -5,5 -18,0 -5,-5"
              fill="#FEF08A"
              style={{ filter: 'drop-shadow(0 0 8px #F59E0B)' }}
            />
          </g>
        )}

        {/* 8. Render Static Tokens with smooth settle and revert transitions */}
        <g id="tokens-layer">
          {Array.from(tokenCoords.entries()).map(([id, item]) => {
            return (
              <g
                key={id}
                transform={`translate(${item.coord.x}, ${item.coord.y})`}
                style={{
                  transition: revertingActive
                    ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    : 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <TokenSvg
                  id={id}
                  color={item.color}
                  isLegal={item.isLegal}
                  onClick={() => {
                    // If token in base and base exit is legal, pass legalBaseTokenId
                    if (tokens[id]?.step === STEP_BASE && legalBaseTokenId) {
                      onSelectToken(legalBaseTokenId);
                    } else {
                      onSelectToken(id);
                    }
                  }}
                />
              </g>
            );
          })}
        </g>

        {/* 9. Active Moving Token Layer (rendered on top with dynamic shadow & continuous hop arc) */}
        {movingToken && (
          <g id="active-moving-token" className="pointer-events-none">
            {/* Dynamic Ground Shadow */}
            <ellipse
              cx={movingToken.shadowX}
              cy={movingToken.shadowY}
              rx={movingToken.shadowRx}
              ry={movingToken.shadowRy}
              fill="#000000"
              opacity={movingToken.shadowOpacity}
            />
            {/* Lifted Animated Token */}
            <g
              transform={`translate(${movingToken.x}, ${movingToken.y}) scale(${movingToken.scale})`}
              style={{
                filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45))',
              }}
            >
              <TokenSvg
                id={`moving-${movingToken.tokenId}`}
                color={movingToken.color}
                isLegal={false}
              />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
