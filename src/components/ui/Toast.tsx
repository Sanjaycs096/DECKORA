import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { useToastStore, type ToastVariant } from '@/state/toastStore';
import { cn } from '@/utils/cn';
import { IconButton } from './IconButton';

const variantMeta: Record<ToastVariant, { icon: string; colorClass: string }> = {
  info: { icon: 'info', colorClass: 'text-[var(--aurora-primary)]' },
  success: { icon: 'check_circle', colorClass: 'text-[var(--aurora-success)]' },
  warning: { icon: 'warning', colorClass: 'text-[var(--aurora-warning)]' },
  error: { icon: 'error', colorClass: 'text-[var(--aurora-error)]' },
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed right-5 bottom-5 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((item) => {
        const meta = variantMeta[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className="aurora-glass-elevated flex items-start gap-3 p-3.5 text-sm text-[var(--aurora-text)]"
          >
            <MaterialSymbol name={meta.icon} size={20} className={cn('mt-0.5', meta.colorClass)} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-[var(--aurora-text-secondary)]">
                  {item.description}
                </p>
              )}
            </div>
            <IconButton
              icon="close"
              label="Dismiss notification"
              size="sm"
              iconSize={16}
              onClick={() => dismiss(item.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
