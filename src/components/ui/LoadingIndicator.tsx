import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { cn } from '@/utils/cn';

export interface LoadingIndicatorProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 28,
} as const;

export function LoadingIndicator({ label, size = 'md', className }: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]',
        className,
      )}
    >
      <MaterialSymbol
        name="progress_activity"
        size={sizeMap[size]}
        className="animate-spin text-[var(--aurora-primary)]"
      />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  );
}
