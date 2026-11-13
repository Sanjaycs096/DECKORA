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
  const iceGradientId = `deckora-ice-${uid}`;
  const violetGradientId = `deckora-violet-${uid}`;

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
            fillRule="evenodd"
            clipRule="evenodd"
            d="M44 30H68C88.9868 30 104 44.3269 104 64C104 83.6731 88.9868 98 68 98H44V30ZM58 44V84H68C80.1503 84 89 75.5 89 64C89 52.5 80.1503 44 68 44H58Z"
            fill="#FFFFFF"
            fillOpacity="0.38"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M28 24H56C78.6437 24 94 40.5655 94 64C94 87.4345 78.6437 104 56 104H28V24ZM43 39V89H56C69.2548 89 79 78.5 79 64C79 49.5 69.2548 39 56 39H43Z"
            fill="#FFFFFF"
          />
          <circle cx="96" cy="32" r="5" fill="#FFFFFF" />
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
            fillRule="evenodd"
            clipRule="evenodd"
            d="M44 30H68C88.9868 30 104 44.3269 104 64C104 83.6731 88.9868 98 68 98H44V30ZM58 44V84H68C80.1503 84 89 75.5 89 64C89 52.5 80.1503 44 68 44H58Z"
            fill="#0B1220"
            fillOpacity="0.35"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M28 24H56C78.6437 24 94 40.5655 94 64C94 87.4345 78.6437 104 56 104H28V24ZM43 39V89H56C69.2548 89 79 78.5 79 64C79 49.5 69.2548 39 56 39H43Z"
            fill="#0B1220"
          />
          <circle cx="96" cy="32" r="5" fill="#0B1220" />
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
            fill="#EAF4FF"
            stroke="#1E2A44"
            strokeOpacity="0.16"
            strokeWidth="2"
          />
          <path
            d="M44 30H68C88.9868 30 104 44.3269 104 64C104 83.6731 88.9868 98 68 98H44V30ZM58 44V84H68C80.1503 84 89 75.5 89 64C89 52.5 80.1503 44 68 44H58Z"
            fill="#8B7CF6"
            fillOpacity="0.85"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M28 24H56C78.6437 24 94 40.5655 94 64C94 87.4345 78.6437 104 56 104H28V24ZM43 39V89H56C69.2548 89 79 78.5 79 64C79 49.5 69.2548 39 56 39H43Z"
            fill="#1E2A44"
          />
          <circle cx="96" cy="32" r="5" fill="#34D399" />
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
            id={violetGradientId}
            x1="28"
            y1="22"
            x2="104"
            y2="104"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#8B7CF6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#5B4FD6" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient
            id={iceGradientId}
            x1="24"
            y1="20"
            x2="96"
            y2="108"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#EAF4FF" />
            <stop offset="48%" stopColor="#7FD3F7" />
            <stop offset="100%" stopColor="#38BDF8" />
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
          strokeOpacity="0.28"
          strokeWidth="2"
        />
        <path
          d="M44 30H68C88.9868 30 104 44.3269 104 64C104 83.6731 88.9868 98 68 98H44V30ZM58 44V84H68C80.1503 84 89 75.5 89 64C89 52.5 80.1503 44 68 44H58Z"
          fill={`url(#${violetGradientId})`}
        />
        <path
          d="M36 27H61C82.5391 27 98 42.67 98 64C98 85.33 82.5391 101 61 101H36V27ZM51 42V86H61C73.7025 86 83 76.6 83 64C83 51.4 73.7025 42 61 42H51Z"
          fill="#1E2A44"
          fillOpacity="0.88"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M28 24H56C78.6437 24 94 40.5655 94 64C94 87.4345 78.6437 104 56 104H28V24ZM43 39V89H56C69.2548 89 79 78.5 79 64C79 49.5 69.2548 39 56 39H43Z"
          fill={`url(#${iceGradientId})`}
        />
        <rect x="28" y="72" width="64" height="2.5" rx="1.25" fill="#EAF4FF" fillOpacity="0.45" />
        <circle cx="96" cy="32" r="5" fill="#34D399" />
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
