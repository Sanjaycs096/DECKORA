import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'aurora-focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-[var(--aurora-duration-fast)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--aurora-primary)] text-[var(--aurora-primary-foreground)] shadow-sm hover:brightness-110',
        royal: 'bg-[var(--aurora-accent)] text-white shadow-sm hover:brightness-110',
        glass:
          'aurora-glass text-[var(--aurora-text)] hover:border-[var(--aurora-border-highlight)]',
        secondary:
          'bg-[var(--aurora-secondary)] text-[var(--aurora-secondary-foreground)] hover:brightness-110',
        outline:
          'border border-[var(--aurora-border)] bg-transparent text-[var(--aurora-text)] hover:bg-[var(--aurora-surface)] hover:border-[var(--aurora-border-highlight)]',
        ghost:
          'bg-transparent text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface)] hover:text-[var(--aurora-text)]',
        destructive: 'bg-[var(--aurora-error)] text-white hover:brightness-110',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
