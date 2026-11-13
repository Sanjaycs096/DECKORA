import type { ReactNode } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { cn } from '@/utils/cn';
import { GlassPanel } from './GlassPanel';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <GlassPanel className={cn('p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--aurora-border)] pb-3">
        <div className="flex items-start gap-2.5">
          {icon && (
            <MaterialSymbol name={icon} size={20} className="mt-0.5 text-[var(--aurora-primary)]" />
          )}
          <div>
            <h3 className="font-[var(--font-display)] text-sm font-semibold text-[var(--aurora-text)]">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-xs text-[var(--aurora-text-secondary)]">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </GlassPanel>
  );
}
