import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface MaterialSymbolProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Material Symbols Rounded ligature name, e.g. 'search', 'palette', 'edit'. */
  name: string;
  size?: number;
  fill?: 0 | 1;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
  opticalSize?: 20 | 24 | 40 | 48;
  label?: string;
}

export function MaterialSymbol({
  name,
  size = 20,
  fill = 0,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  label,
  className,
  style,
  ...rest
}: MaterialSymbolProps) {
  const variationStyle: CSSProperties = {
    fontSize: `${size}px`,
    width: `${size}px`,
    height: `${size}px`,
    fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
    ...style,
  };

  return (
    <span
      {...rest}
      className={cn('material-symbols-rounded shrink-0 select-none', className)}
      style={variationStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-icon-name={name}
    >
      {name}
    </span>
  );
}
