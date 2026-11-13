import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
  solidFallback?: boolean;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, elevated = false, interactive = false, solidFallback = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        solidFallback
          ? 'rounded-[var(--glass-radius)] border border-[var(--aurora-border)] bg-[var(--aurora-surface-solid)] shadow-[var(--aurora-shadow-soft)]'
          : elevated
            ? 'aurora-glass-elevated'
            : 'aurora-glass',
        interactive &&
          'transition-all duration-[var(--aurora-duration-fast)] hover:border-[var(--aurora-border-highlight)]',
        className,
      )}
      {...props}
    />
  ),
);

GlassPanel.displayName = 'GlassPanel';
