import React from 'react';

interface SpeedometerLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export const SpeedometerLogo: React.FC<SpeedometerLogoProps> = ({
  size = 72,
  animated = false,
  className = '',
}) => {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background Soft Glow */}
      <div
        className="absolute inset-0 rounded-full blur-xl pointer-events-none opacity-60"
        style={{
          background: 'radial-gradient(circle, rgba(0, 240, 255, 0.45) 0%, rgba(0, 180, 216, 0.15) 60%, transparent 80%)',
        }}
      />

      {/* Speedometer SVG matching reference image */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={`relative z-10 ${animated ? 'transition-transform duration-500 hover:scale-105' : ''}`}
        style={{ filter: 'drop-shadow(0 0 8px rgba(72, 202, 228, 0.65))' }}
      >
        <defs>
          <linearGradient id="cyanNeonGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00B4D8" />
            <stop offset="50%" stopColor="#48CAE4" />
            <stop offset="100%" stopColor="#00F0FF" />
          </linearGradient>

          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Circular Speed Arc */}
        <path
          d="M 18 72 A 38 38 0 1 1 82 72"
          fill="none"
          stroke="url(#cyanNeonGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#neonGlow)"
        />

        {/* Inner Subtle Arc */}
        <path
          d="M 28 67 A 28 28 0 1 1 72 67"
          fill="none"
          stroke="rgba(72, 202, 228, 0.25)"
          strokeWidth="1.5"
          strokeDasharray="2 4"
        />

        {/* Speedometer Ticks */}
        {/* Tick 1 (Left 210 deg) */}
        <line x1="22" y1="64" x2="28" y2="60" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
        {/* Tick 2 (Mid-left 250 deg) */}
        <line x1="28" y1="38" x2="33" y2="42" stroke="#48CAE4" strokeWidth="2" strokeLinecap="round" />
        {/* Tick 3 (Top 270 deg) */}
        <line x1="50" y1="20" x2="50" y2="27" stroke="#00F0FF" strokeWidth="3" strokeLinecap="round" />
        {/* Tick 4 (Mid-right 310 deg) */}
        <line x1="72" y1="38" x2="67" y2="42" stroke="#48CAE4" strokeWidth="2" strokeLinecap="round" />
        {/* Tick 5 (Right 330 deg) */}
        <line x1="78" y1="64" x2="72" y2="60" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />

        {/* Speed Dial Needle (Pointing forward right, dynamic angle) */}
        <line
          x1="50"
          y1="54"
          x2="69"
          y2="37"
          stroke="url(#cyanNeonGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          filter="url(#neonGlow)"
        />

        {/* Center Pivot Circle */}
        <circle
          cx="50"
          cy="54"
          r="6.5"
          fill="#0B132B"
          stroke="#00F0FF"
          strokeWidth="3"
          filter="url(#neonGlow)"
        />
        <circle cx="50" cy="54" r="2.5" fill="#00F0FF" />

        {/* Speed digital indicator line at bottom */}
        <path
          d="M 40 76 L 60 76"
          stroke="#00B4D8"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    </div>
  );
};
