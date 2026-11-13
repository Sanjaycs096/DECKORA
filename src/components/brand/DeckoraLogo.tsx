import { useId } from 'react';
import { cn } from '@/utils/cn';

export type DeckoraLogoVariant = 'full' | 'symbol';
export type DeckoraLogoTone = 'brand' | 'mono-white' | 'mono-dark' | 'light';
export type DeckoraLogoSize = 'sm' | 'md' | 'lg';

export interface DeckoraLogoProps {
  variant?: DeckoraLogoVariant;
  tone?: DeckoraLogoTone;
  size?: DeckoraLogoSize;
  showTagline?: boolean;
  className?: string;
}

const SIZE_MAP: Record<
  DeckoraLogoSize,
  { iconPx: number; wordmarkClass: string; taglineClass: string; gapClass: string }
> = {
  sm: {
    iconPx: 24,
    wordmarkClass: 'text-xs tracking-[0.16em]',
    taglineClass: 'text-[10px]',
    gapClass: 'gap-2',
  },
  md: {
    iconPx: 32,
    wordmarkClass: 'text-sm tracking-[0.16em]',
    taglineClass: 'text-[11px]',
    gapClass: 'gap-2.5',
  },
  lg: {
    iconPx: 44,
    wordmarkClass: 'text-xl tracking-[0.16em]',
    taglineClass: 'text-xs',
    gapClass: 'gap-3',
  },
};

export function DeckoraLogo({
  variant = 'full',
  tone = 'brand',
  size = 'md',
  showTagline = false,
  className,
}: DeckoraLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const dims = SIZE_MAP[size];

  const bgGradientId = `deckora-bg-${uid}`;
  const topGradientId = `deckora-top-${uid}`;
  const botGradientId = `deckora-bot-${uid}`;

  const wordmarkColorClass =
    tone === 'mono-white'
      ? 'text-white'
      : tone === 'mono-dark'
        ? 'text-[#0B1220]'
        : tone === 'light'
          ? 'text-[#0B1220]'
          : 'text-[var(--aurora-text)]';

  const taglineColorClass =
    tone === 'mono-white'
      ? 'text-white/75'
      : tone === 'mono-dark'
        ? 'text-[#1E2A44]/80'
        : tone === 'light'
          ? 'text-[#1E2A44]'
          : 'text-[var(--aurora-primary)]';

  const renderMark = () => {
    if (tone === 'mono-white') {
      return (
        <svg
          width={dims.iconPx}
          height={dims.iconPx}
          viewBox="0 0 128 128"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M26 36C26 29.3726 31.3726 24 38 24H62C84.0914 24 102 41.9086 102 62H80C80 52.0589 71.9411 44 62 44H50V62H26V36Z"
            fill="#FFFFFF"
          />
          <path
            d="M26 66H50V84H62C71.9411 84 80 75.9411 80 66H102C102 86.0914 84.0914 104 62 104H38C31.3726 104 26 98.6274 26 92V66Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    }

    if (tone === 'mono-dark') {
      return (
        <svg
          width={dims.iconPx}
          height={dims.iconPx}
          viewBox="0 0 128 128"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M26 36C26 29.3726 31.3726 24 38 24H62C84.0914 24 102 41.9086 102 62H80C80 52.0589 71.9411 44 62 44H50V62H26V36Z"
            fill="#0B1220"
          />
          <path
            d="M26 66H50V84H62C71.9411 84 80 75.9411 80 66H102C102 86.0914 84.0914 104 62 104H38C31.3726 104 26 98.6274 26 92V66Z"
            fill="#0B1220"
          />
        </svg>
      );
    }

    if (tone === 'light') {
      return (
        <svg
          width={dims.iconPx}
          height={dims.iconPx}
          viewBox="0 0 128 128"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect
            x="4"
            y="4"
            width="120"
            height="120"
            rx="28"
            fill="#F0F9FF"
            stroke="#1E2A44"
            strokeOpacity="0.16"
            strokeWidth="2"
          />
          <path
            d="M26 36C26 29.3726 31.3726 24 38 24H62C84.0914 24 102 41.9086 102 62H80C80 52.0589 71.9411 44 62 44H50V62H26V36Z"
            fill="#0B1220"
          />
          <path
            d="M26 66H50V84H62C71.9411 84 80 75.9411 80 66H102C102 86.0914 84.0914 104 62 104H38C31.3726 104 26 98.6274 26 92V66Z"
            fill="#38BDF8"
          />
        </svg>
      );
    }

    return (
      <svg
        width={dims.iconPx}
        height={dims.iconPx}
        viewBox="0 0 128 128"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id={bgGradientId}
            x1="12"
            y1="8"
            x2="116"
            y2="120"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1E2A44" />
            <stop offset="100%" stopColor="#0B1220" />
          </linearGradient>
          <linearGradient
            id={topGradientId}
            x1="26"
            y1="24"
            x2="102"
            y2="62"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#EAF4FF" />
            <stop offset="48%" stopColor="#7FD3F7" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
          <linearGradient
            id={botGradientId}
            x1="26"
            y1="66"
            x2="102"
            y2="104"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#8B7CF6" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <rect
          x="4"
          y="4"
          width="120"
          height="120"
          rx="28"
          fill={`url(#${bgGradientId})`}
          stroke="#7FD3F7"
          strokeOpacity="0.24"
          strokeWidth="2"
        />
        <path
          d="M26 36C26 29.3726 31.3726 24 38 24H62C84.0914 24 102 41.9086 102 62H80C80 52.0589 71.9411 44 62 44H50V62H26V36Z"
          fill={`url(#${topGradientId})`}
        />
        <path
          d="M26 66H50V84H62C71.9411 84 80 75.9411 80 66H102C102 86.0914 84.0914 104 62 104H38C31.3726 104 26 98.6274 26 92V66Z"
          fill={`url(#${botGradientId})`}
        />
      </svg>
    );
  };

  if (variant === 'symbol') {
    return (
      <span
        className={cn('inline-flex items-center justify-center', className)}
        data-testid="deckora-logo-symbol"
      >
        {renderMark()}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-center select-none', dims.gapClass, className)}
      data-testid="deckora-logo"
    >
      {renderMark()}
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-[var(--font-display)] font-extrabold uppercase',
            dims.wordmarkClass,
            wordmarkColorClass,
          )}
        >
          DECKORA
        </span>
        {showTagline && (
          <span
            className={cn('mt-1 font-medium tracking-normal', dims.taglineClass, taglineColorClass)}
          >
            Your Personal Browser Workspace
          </span>
        )}
      </span>
    </span>
  );
}
