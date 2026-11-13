import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef, useState, type ComponentPropsWithoutRef, type ComponentRef } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { cn } from '@/utils/cn';

export const Dropdown = DropdownMenuPrimitive.Root;
export const DropdownTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownGroup = DropdownMenuPrimitive.Group;

export const DropdownContent = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[80] max-h-[min(320px,65vh)] min-w-[11rem] overflow-y-auto rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-menu-bg)] p-1.5 text-[var(--aurora-menu-text)] shadow-[var(--aurora-shadow-elevated)] backdrop-blur-xl focus:outline-none',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownContent.displayName = 'DropdownContent';

export const DropdownItem = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    icon?: string;
    selected?: boolean;
  }
>(({ className, icon, selected = false, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    data-selected={selected ? 'true' : undefined}
    className={cn(
      'relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-normal text-[var(--aurora-menu-text)] outline-none transition-colors select-none data-[disabled]:pointer-events-none data-[disabled]:text-[var(--aurora-menu-disabled-text)] data-[disabled]:opacity-75 data-[highlighted]:bg-[var(--aurora-menu-hover-bg)] data-[highlighted]:text-[var(--aurora-menu-hover-text)]',
      selected &&
        'bg-[var(--aurora-menu-selected-bg)] font-medium text-[var(--aurora-menu-selected-text)]',
      className,
    )}
    {...props}
  >
    {icon && (
      <MaterialSymbol
        name={icon}
        size={18}
        className={
          selected
            ? 'text-[var(--aurora-menu-selected-text)]'
            : 'text-[var(--aurora-menu-text-secondary)]'
        }
      />
    )}
    <span className="flex-1">{children}</span>
    {selected && (
      <MaterialSymbol
        name="check"
        size={15}
        className="shrink-0 text-[var(--aurora-menu-selected-text)]"
      />
    )}
  </DropdownMenuPrimitive.Item>
));
DropdownItem.displayName = 'DropdownItem';

export const DropdownCheckboxItem = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      'relative flex cursor-pointer items-center gap-2.5 rounded-lg py-2 pr-2.5 pl-8 text-sm text-[var(--aurora-menu-text)] outline-none transition-colors select-none data-[disabled]:pointer-events-none data-[disabled]:text-[var(--aurora-menu-disabled-text)] data-[disabled]:opacity-75 data-[highlighted]:bg-[var(--aurora-menu-hover-bg)] data-[highlighted]:text-[var(--aurora-menu-hover-text)]',
      checked &&
        'bg-[var(--aurora-menu-selected-bg)] font-medium text-[var(--aurora-menu-selected-text)]',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <MaterialSymbol
          name="check"
          size={16}
          className="text-[var(--aurora-menu-selected-text)]"
        />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownCheckboxItem.displayName = 'DropdownCheckboxItem';

export const DropdownSeparator = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('my-1 h-px bg-[var(--aurora-border)]', className)}
    {...props}
  />
));
DropdownSeparator.displayName = 'DropdownSeparator';

export const DropdownLabel = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-[var(--aurora-menu-text-secondary)] uppercase',
      className,
    )}
    {...props}
  />
));
DropdownLabel.displayName = 'DropdownLabel';

export interface SelectDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectDropdownProps {
  id?: string;
  ariaLabel: string;
  value: string;
  options: SelectDropdownOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
  placeholder?: string;
  className?: string;
  contentClassName?: string;
}

export function SelectDropdown({
  id,
  ariaLabel,
  value,
  options,
  onValueChange,
  disabled = false,
  align = 'start',
  placeholder = 'Select option...',
  className,
  contentClassName,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const activeOption = options.find((opt) => opt.value === value);

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <DropdownTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'aurora-focus-ring flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-[var(--aurora-border)] bg-[var(--aurora-menu-trigger-bg)] px-2.5 text-left text-xs text-[var(--aurora-menu-text)] transition-colors hover:border-[var(--aurora-border-highlight)] disabled:cursor-not-allowed disabled:text-[var(--aurora-menu-disabled-text)] disabled:opacity-70',
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{activeOption?.label ?? placeholder}</span>
          <MaterialSymbol
            name="expand_more"
            size={16}
            className="shrink-0 text-[var(--aurora-menu-text-secondary)]"
          />
        </button>
      </DropdownTrigger>
      <DropdownContent align={align} className={cn('min-w-[11rem]', contentClassName)}>
        {options.map((opt) => (
          <DropdownItem
            key={opt.value}
            disabled={opt.disabled}
            selected={opt.value === value}
            onSelect={() => onValueChange(opt.value)}
            className="py-1.5 text-xs"
          >
            {opt.label}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
