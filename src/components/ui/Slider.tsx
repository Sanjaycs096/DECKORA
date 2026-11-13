import * as SliderPrimitive from '@radix-ui/react-slider';
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react';
import { cn } from '@/utils/cn';

export const Slider = forwardRef<
  ComponentRef<typeof SliderPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none items-center select-none py-1.5', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--aurora-secondary)]">
      <SliderPrimitive.Range className="absolute h-full bg-[var(--aurora-primary)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="aurora-focus-ring block h-4 w-4 cursor-pointer rounded-full border-2 border-[var(--aurora-primary)] bg-[var(--aurora-bg-elevated)] shadow-sm transition-transform hover:scale-110 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));

Slider.displayName = 'Slider';
