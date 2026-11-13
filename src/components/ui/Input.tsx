import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid = false, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'aurora-focus-ring flex h-10 w-full rounded-xl border bg-[var(--aurora-surface)] px-3.5 py-2 text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] transition-colors duration-[var(--aurora-duration-fast)] disabled:cursor-not-allowed disabled:opacity-50',
        invalid
          ? 'border-[var(--aurora-error)]'
          : 'border-[var(--aurora-border)] hover:border-[var(--aurora-border-highlight)] focus:border-[var(--aurora-primary)]',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
