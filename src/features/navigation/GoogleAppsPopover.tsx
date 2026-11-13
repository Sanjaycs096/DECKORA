import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { IconButton, SearchInput } from '@/components/ui';
import { sanitizeHttpUrl } from '@/utils/url';
import { GOOGLE_APPS, GOOGLE_APP_CATEGORY_ORDER, type GoogleAppShortcut } from './navDestinations';

export interface GoogleAppsPopoverProps {
  onNavigate?: (url: string) => void;
}

export function GoogleAppsPopover({ onNavigate }: GoogleAppsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const groupedApps = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matchesQuery = (app: GoogleAppShortcut) => {
      if (terms.length === 0) return true;
      const haystack = `${app.label} ${app.category} ${app.keywords}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    };

    return GOOGLE_APP_CATEGORY_ORDER.map((category) => ({
      category,
      apps: GOOGLE_APPS.filter((app) => app.category === category && matchesQuery(app)),
    })).filter((group) => group.apps.length > 0);
  }, [query]);

  const totalVisible = groupedApps.reduce((sum, group) => sum + group.apps.length, 0);

  const handleSelectApp = (rawUrl: string) => {
    const safeUrl = sanitizeHttpUrl(rawUrl);
    if (!safeUrl) return;
    setOpen(false);
    if (onNavigate) {
      onNavigate(safeUrl);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        ref={triggerRef}
        icon="apps"
        label="Google Apps"
        variant="glass"
        size="md"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full"
      />

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Google Apps Launcher"
          className="aurora-glass-elevated absolute top-12 right-0 z-50 flex max-h-[min(78vh,34rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-3.5 shadow-2xl sm:w-96"
        >
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="font-[var(--font-display)] text-xs font-semibold tracking-wide text-[var(--aurora-text-secondary)] uppercase">
              Google Apps
            </span>
            <span className="text-[11px] text-[var(--aurora-text-muted)]">
              {totalVisible} {totalVisible === 1 ? 'app' : 'apps'}
            </span>
          </div>

          <div className="mb-3">
            <SearchInput
              ref={searchRef}
              aria-label="Search Google Apps"
              placeholder="Search Google apps..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery('')}
            />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {groupedApps.length === 0 ? (
              <div className="rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-5 text-center text-xs text-[var(--aurora-text-secondary)]">
                No Google apps matched &ldquo;{query.trim()}&rdquo;.
              </div>
            ) : (
              groupedApps.map((group) => (
                <section key={group.category} aria-label={group.category} className="space-y-1.5">
                  <h3 className="px-1 text-[10px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                    {group.category}
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {group.apps.map((app) => {
                      const safeUrl = sanitizeHttpUrl(app.url) ?? app.url;
                      return (
                        <a
                          key={app.id}
                          href={safeUrl}
                          target={onNavigate ? undefined : '_blank'}
                          rel={onNavigate ? undefined : 'noopener noreferrer'}
                          onClick={(event) => {
                            if (onNavigate) {
                              event.preventDefault();
                              handleSelectApp(safeUrl);
                            } else {
                              setOpen(false);
                            }
                          }}
                          className="aurora-focus-ring group flex flex-col items-center justify-center gap-1.5 rounded-xl p-2 text-center transition-colors duration-[var(--aurora-duration-fast)] hover:bg-[var(--aurora-surface)]"
                        >
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)] transition-transform duration-[var(--aurora-duration-fast)] group-hover:scale-105"
                            style={{ color: app.accentTint }}
                          >
                            <MaterialSymbol name={app.icon} size={20} />
                          </span>
                          <span className="w-full truncate text-[11px] font-medium text-[var(--aurora-text)]">
                            {app.label}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
