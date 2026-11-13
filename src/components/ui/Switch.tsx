import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react';
import { cn } from '@/utils/cn';

export const Switch = forwardRef<
  ComponentRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'aurora-focus-ring peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--aurora-border)] bg-[var(--aurora-secondary)] p-0.5 transition-colors duration-[var(--aurora-duration-fast)] data-[state=checked]:border-transparent data-[state=checked]:bg-[var(--aurora-primary)] disabled:cursor-not-allowed disabled:opacity-45',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-4.5 w-4.5 rounded-full bg-[var(--aurora-text)] shadow-sm transition-transform duration-[var(--aurora-duration-fast)] data-[state=checked]:translate-x-5 data-[state=checked]:bg-[var(--aurora-primary-foreground)]',
      )}
    />
  </SwitchPrimitive.Root>
));

Switch.displayName = 'Switch';
