import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { cn } from '@/utils/cn';

const iconButtonVariants = cva(
  'aurora-focus-ring inline-flex items-center justify-center rounded-xl transition-all duration-[var(--aurora-duration-fast)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
  {
    variants: {
      variant: {
        glass:
          'aurora-glass text-[var(--aurora-text)] hover:border-[var(--aurora-border-highlight)]',
        ghost:
          'text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface)] hover:text-[var(--aurora-text)]',
        primary:
          'bg-[var(--aurora-primary)] text-[var(--aurora-primary-foreground)] hover:brightness-110',
        outline:
          'border border-[var(--aurora-border)] text-[var(--aurora-text)] hover:border-[var(--aurora-border-highlight)] hover:bg-[var(--aurora-surface)]',
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-9 w-9',
        lg: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);

export interface IconButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  icon: string;
  label: string;
  iconSize?: number;
  filled?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      iconSize = 20,
      filled = false,
      variant,
      size,
      className,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <MaterialSymbol name={icon} size={iconSize} fill={filled ? 1 : 0} />
    </button>
  ),
);

IconButton.displayName = 'IconButton';
