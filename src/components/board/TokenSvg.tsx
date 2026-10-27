/**
 * TokenSvg.tsx
 *
 * High-fidelity 3D-styled Ludo pawn rendered in SVG.
 * Features realistic radial gradients, specular shines, bevels,
 * pulsing legal-move indicator ring, and interactive click handler.
 */

import React from 'react';
import { PlayerColor } from '@/engine';

interface TokenSvgProps {
  id: string;
  color: PlayerColor;
  isLegal: boolean;
  isSelected?: boolean;
  size?: number;
  onClick?: () => void;
  className?: string;
}

export const TokenSvg: React.FC<TokenSvgProps> = ({
  id,
  color,
  isLegal,
  isSelected = false,
  size = 32,
  onClick,
  className = '',
}) => {
  const colorGradients: Record<
    PlayerColor,
    {
      topShine: string;
      bodyLight: string;
      bodyMid: string;
      bodyDark: string;
      rimDark: string;
      glow: string;
    }
  > = {
    red: {
      topShine: '#FEE2E2',
      bodyLight: '#F87171',
      bodyMid: '#EF4444',
      bodyDark: '#B91C1C',
      rimDark: '#7F1D1D',
      glow: '#EF4444',
    },
    green: {
      topShine: '#DCFCE7',
      bodyLight: '#4ADE80',
      bodyMid: '#22C55E',
      bodyDark: '#15803D',
      rimDark: '#14532D',
      glow: '#22C55E',
    },
    yellow: {
      topShine: '#FEF9C3',
      bodyLight: '#FDE047',
      bodyMid: '#FACC15',
      bodyDark: '#CA8A04',
      rimDark: '#854D0E',
      glow: '#FACC15',
    },
    blue: {
      topShine: '#DBEAFE',
      bodyLight: '#60A5FA',
      bodyMid: '#3B82F6',
      bodyDark: '#1D4ED8',
      rimDark: '#1E3A8A',
      glow: '#3B82F6',
    },
  };

  const g = colorGradients[color];

  return (
    <g
      id={id}
      onClick={isLegal ? onClick : undefined}
      className={`${isLegal ? 'cursor-pointer' : ''} ${className}`}
      style={{
        transformOrigin: 'center center',
      }}
    >
      <defs>
        {/* Shadow filter */}
        <filter id={`shadow-${id}`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>

        {/* Head Sphere 3D gradient */}
        <radialGradient id={`head-grad-${id}`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor={g.topShine} />
          <stop offset="25%" stopColor={g.bodyLight} />
          <stop offset="70%" stopColor={g.bodyMid} />
          <stop offset="100%" stopColor={g.bodyDark} />
        </radialGradient>

        {/* Body Cone 3D gradient */}
        <linearGradient id={`body-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={g.bodyDark} />
          <stop offset="35%" stopColor={g.bodyLight} />
          <stop offset="75%" stopColor={g.bodyMid} />
          <stop offset="100%" stopColor={g.rimDark} />
        </linearGradient>

        {/* Base Bevel gradient */}
        <radialGradient id={`base-grad-${id}`} cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor={g.bodyLight} />
          <stop offset="60%" stopColor={g.bodyMid} />
          <stop offset="100%" stopColor={g.rimDark} />
        </radialGradient>
      </defs>

      {/* Large invisible hit circle for easy mobile tap targets */}
      <circle
        cx="0"
        cy="0"
        r={size * 1.15}
        fill="transparent"
        className={isLegal ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}
      />

      {/* Pulsing selection indicator ring when legal or selected */}
      {(isLegal || isSelected) && (
        <circle
          cx="0"
          cy="0"
          r={size * 0.72}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          className="legal-token-glow"
          style={{
            filter: `drop-shadow(0 0 8px ${g.glow})`,
          }}
        />
      )}

      {/* Ground drop shadow */}
      <ellipse
        cx="0"
        cy={size * 0.42}
        rx={size * 0.45}
        ry={size * 0.18}
        fill="#000000"
        opacity="0.38"
      />

      <g filter={`url(#shadow-${id})`}>
        {/* Base Pedestal rim */}
        <ellipse
          cx="0"
          cy={size * 0.32}
          rx={size * 0.44}
          ry={size * 0.22}
          fill={`url(#base-grad-${id})`}
          stroke={g.rimDark}
          strokeWidth="1"
        />

        {/* Base top face */}
        <ellipse
          cx="0"
          cy={size * 0.26}
          rx={size * 0.36}
          ry={size * 0.16}
          fill={g.bodyLight}
          opacity="0.75"
        />

        {/* Middle flared body */}
        <path
          d={`M ${-size * 0.28} ${size * 0.24} 
              Q ${-size * 0.12} ${-size * 0.04} ${-size * 0.16} ${-size * 0.15} 
              L ${size * 0.16} ${-size * 0.15} 
              Q ${size * 0.12} ${-size * 0.04} ${size * 0.28} ${size * 0.24} 
              Z`}
          fill={`url(#body-grad-${id})`}
        />

        {/* Collar ring */}
        <ellipse
          cx="0"
          cy={-size * 0.15}
          rx={size * 0.22}
          ry={size * 0.08}
          fill={`url(#base-grad-${id})`}
          stroke={g.rimDark}
          strokeWidth="0.8"
        />

        {/* Spherical head */}
        <circle
          cx="0"
          cy={-size * 0.32}
          r={size * 0.25}
          fill={`url(#head-grad-${id})`}
          stroke={g.rimDark}
          strokeWidth="0.6"
        />

        {/* Specular head shine */}
        <ellipse
          cx={-size * 0.08}
          cy={-size * 0.4}
          rx={size * 0.08}
          ry={size * 0.05}
          fill="#FFFFFF"
          opacity="0.85"
          transform={`rotate(-25, ${-size * 0.08}, ${-size * 0.4})`}
        />
      </g>
    </g>
  );
};
