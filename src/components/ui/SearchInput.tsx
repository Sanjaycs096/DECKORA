import { forwardRef, type InputHTMLAttributes } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { cn } from '@/utils/cn';
import { IconButton } from './IconButton';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
  showSearchIcon?: boolean;
  visualStyle?: 'glass' | 'solid';
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onClear,
      showSearchIcon = true,
      visualStyle = 'glass',
      placeholder = 'Search...',
      ...props
    },
    ref,
  ) => {
    const hasValue = typeof value === 'string' && value.length > 0;

    return (
      <div
        className={cn(
          'relative flex items-center rounded-full transition-all duration-[var(--aurora-duration-fast)] focus-within:border-[var(--aurora-border-highlight)]',
          visualStyle === 'glass'
            ? 'aurora-glass'
            : 'border border-[var(--aurora-border)] bg-[var(--aurora-surface-solid)] shadow-[var(--aurora-shadow-soft)]',
          className,
        )}
      >
        {showSearchIcon && (
          <span className="pointer-events-none flex items-center pl-4 text-[var(--aurora-text-secondary)]">
            <MaterialSymbol name="search" size={20} />
          </span>
        )}
        <input
          ref={ref}
          type="search"
          value={value}
          placeholder={placeholder}
          className={cn(
            'h-11 w-full bg-transparent text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] focus:outline-none',
            showSearchIcon ? 'pl-3' : 'pl-4',
            hasValue && onClear ? 'pr-10' : 'pr-4',
          )}
          {...props}
        />
        {hasValue && onClear && (
          <IconButton
            icon="close"
            label="Clear search"
            iconSize={18}
            size="sm"
            onClick={onClear}
            className="absolute right-1.5 rounded-full"
          />
        )}
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
