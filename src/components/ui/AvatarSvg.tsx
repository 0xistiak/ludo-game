/**
 * AvatarSvg.tsx
 *
 * Crisp, stylized SVG avatars drawn with pure vector shapes.
 * Zero external images or network dependencies.
 */

import React from 'react';
import { PlayerColor } from '@/engine';

interface AvatarSvgProps {
  color?: PlayerColor;
  size?: number;
  seed?: number;
  className?: string;
}

export const AvatarSvg: React.FC<AvatarSvgProps> = ({
  color = 'red',
  size = 48,
  seed = 0,
  className = '',
}) => {
  const colorBorders: Record<PlayerColor, string> = {
    red: '#EF4444',
    green: '#22C55E',
    yellow: '#FACC15',
    blue: '#3B82F6',
  };

  const bgGrads: Record<PlayerColor, [string, string]> = {
    red: ['#FCA5A5', '#EF4444'],
    green: ['#86EFAC', '#22C55E'],
    yellow: ['#FDE047', '#EAB308'],
    blue: ['#93C5FD', '#3B82F6'],
  };

  const [bg1, bg2] = bgGrads[color] || bgGrads.red;
  const borderColor = colorBorders[color] || '#3B82F6';

  // 4 varied character styles based on seed or color
  const hairColors = ['#1E293B', '#78350F', '#0F172A', '#451A03'];
  const skinColors = ['#FCD34D', '#FDE68A', '#FBCFE8', '#FBBF24'];
  const shirtColors = ['#EF4444', '#22C55E', '#F59E0B', '#3B82F6'];

  const hair = hairColors[seed % 4];
  const skin = skinColors[seed % 4];
  const shirt = shirtColors[seed % 4];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`rounded-full shrink-0 ${className}`}
      style={{ border: `2.5px solid ${borderColor}`, filter: `drop-shadow(0 2px 8px ${borderColor}66)` }}
    >
      <defs>
        <radialGradient id={`bg-grad-${color}-${seed}`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor={bg1} />
          <stop offset="100%" stopColor={bg2} />
        </radialGradient>
      </defs>

      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill={`url(#bg-grad-${color}-${seed})`} />

      {/* Body / Shirt */}
      <path
        d="M20,95 Q50,68 80,95 L80,100 L20,100 Z"
        fill={shirt}
      />
      {/* Shirt collar detail */}
      <path d="M42,75 L50,85 L58,75" stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Neck */}
      <rect x="44" y="60" width="12" height="15" fill={skin} rx="4" />

      {/* Head */}
      <circle cx="50" cy="45" r="22" fill={skin} />

      {/* Hair (back/top) */}
      <path
        d="M26,45 Q24,20 50,18 Q76,20 74,45 Q70,25 50,24 Q30,25 26,45 Z"
        fill={hair}
      />
      {/* Fringe / bangs */}
      <path
        d="M32,32 Q45,36 50,28 Q55,36 68,32 Q58,24 50,25 Q42,24 32,32 Z"
        fill={hair}
      />

      {/* Eyes */}
      <circle cx="42" cy="45" r="3" fill="#0F172A" />
      <circle cx="58" cy="45" r="3" fill="#0F172A" />
      {/* Specular eye sparkle */}
      <circle cx="43" cy="44" r="1" fill="#FFFFFF" />
      <circle cx="59" cy="44" r="1" fill="#FFFFFF" />

      {/* Smile */}
      <path
        d="M44,53 Q50,59 56,53"
        stroke="#78350F"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Cheeks blush */}
      <ellipse cx="36" cy="49" rx="3.5" ry="2" fill="#F87171" opacity="0.6" />
      <ellipse cx="64" cy="49" rx="3.5" ry="2" fill="#F87171" opacity="0.6" />
    </svg>
  );
};
