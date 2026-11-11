import React from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showText?: boolean;
  subtitle?: string;
  variant?: 'light' | 'dark' | 'color';
}

/**
 * CyberTech AI Bespoke Brand Mark
 * Hand-crafted geometric sentinel emblem combining an interlocking protective aegis
 * with a contextual multilingual focal lens.
 * Clean, bold, and free of generic AI-generated slop or floating gradient orbs.
 */
export function BrandMark({ size = 'md', className = '' }: { size?: BrandLogoProps['size']; className?: string }) {
  let pixelSize = 36;
  if (typeof size === 'number') {
    pixelSize = size;
  } else {
    switch (size) {
      case 'xs':
        pixelSize = 20;
        break;
      case 'sm':
        pixelSize = 28;
        break;
      case 'md':
        pixelSize = 36;
        break;
      case 'lg':
        pixelSize = 44;
        break;
      case 'xl':
        pixelSize = 56;
        break;
    }
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-[#181926] border border-[#2D2E42] shadow-sm select-none shrink-0 transition-transform hover:scale-[1.02] ${className}`}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
      }}
      title="CyberTech AI"
      aria-label="CyberTech AI Brand Mark"
    >
      <svg
        width={Math.round(pixelSize * 0.72)}
        height={Math.round(pixelSize * 0.72)}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Outer Architectural Bastion Contour */}
        <path
          d="M16 3.5L27 7.8V15.5C27 22.2 22.2 27.2 16 29C9.8 27.2 5 22.2 5 15.5V7.8L16 3.5Z"
          stroke="#4E5171"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Left Wing (Contextual Ingestion Facet) */}
        <path
          d="M16 6L24.5 9.4V15C24.5 20.4 20.8 24.5 16 26V19.5C18.2 18.2 19.8 16.5 19.8 14.5V10.8L16 9.2V6Z"
          fill="#818CF8"
        />

        {/* Right Wing (Protective Enforcement Facet) */}
        <path
          d="M16 6L7.5 9.4V15C7.5 20.4 11.2 24.5 16 26V19.5C13.8 18.2 12.2 16.5 12.2 14.5V10.8L16 9.2V6Z"
          fill="#6366F1"
        />

        {/* Central Geometric Monogram Anchor (The T-Spine Pillar) */}
        <path
          d="M12 9.5H20V12H17.2V22H14.8V12H12V9.5Z"
          fill="#FFFFFF"
        />

        {/* Precision Optical Center (Human Alignment & Ground Truth Core) */}
        <circle cx="16" cy="15.5" r="1.75" fill="#F43F5E" />
      </svg>
    </div>
  );
}

export default function BrandLogo({
  size = 'md',
  className = '',
  showText = true,
  subtitle = 'Trust & Safety Ops',
}: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} />
      {showText && (
        <div className="flex flex-col">
          <div className="text-sm sm:text-base font-extrabold tracking-tight text-[#20212B] leading-none flex items-center gap-1.5">
            <span>CyberTech</span>
            <span className="text-[#6366F1]">AI</span>
          </div>
          {subtitle && (
            <span className="text-[10px] font-bold text-[#858795] uppercase tracking-wider mt-1 leading-none">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
