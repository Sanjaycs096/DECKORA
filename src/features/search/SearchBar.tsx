import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
  Input,
} from '@/components/ui';
import { DEFAULT_SEARCH_ELEMENT_ID } from '@/services/storage/defaults';
import { parseSearchProps, shortcutsPropsSchema } from '@/services/storage/schemas';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type { SearchElementProps, SearchEngineId, ShortcutItem } from '@/types/workspace';
import {
  SEARCH_PROVIDERS,
  buildSearchUrl,
  getLocalSearchSuggestions,
  recordRecentSearchQuery,
  validateCustomSearchTemplate,
} from './searchProviders';

export interface SearchBarProps {
  elementId?: string;
  propsOverride?: Record<string, unknown>;
  embeddedInCanvas?: boolean;
  disableGlobalShortcut?: boolean;
  onNavigate?: (url: string) => void;
}

export function SearchBar({
  elementId = DEFAULT_SEARCH_ELEMENT_ID,
  propsOverride,
  embeddedInCanvas = false,
  disableGlobalShortcut = false,
  onNavigate,
}: SearchBarProps) {
  const storeSearchProps = useWorkspaceStore(
    (s) => s.workspace.profiles[s.workspace.activeProfileId]?.layout.elements[elementId]?.props,
  );
  const allElements = useWorkspaceStore(
    (s) => s.workspace.profiles[s.workspace.activeProfileId]?.layout.elements,
  );
  const rawSearchProps = propsOverride ?? storeSearchProps;
  const updateElementProps = useWorkspaceStore((s) => s.updateActiveProfileElementProps);

  const searchProps: SearchElementProps = useMemo(
    () => parseSearchProps(rawSearchProps),
    [rawSearchProps],
  );

  const workspaceShortcuts: ShortcutItem[] = useMemo(() => {
    if (!allElements) return [];
    const items: ShortcutItem[] = [];
    for (const el of Object.values(allElements)) {
      if (el.type === 'shortcuts' && el.visible) {
        const parsed = shortcutsPropsSchema.safeParse(el.props);
        if (parsed.success) {
          items.push(...parsed.data.items);
        }
      }
    }
    return items;
  }, [allElements]);

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customTemplateDraft, setCustomTemplateDraft] = useState(
    searchProps.customEngineTemplate || 'https://kagi.com/search?q={query}',
  );
  const [customTemplateError, setCustomTemplateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () =>
      disableGlobalShortcut
        ? []
        : getLocalSearchSuggestions(
            query,
            workspaceShortcuts,
            searchProps.recentQueries,
            searchProps.enableLocalHistory,
          ),
    [
      disableGlobalShortcut,
      query,
      workspaceShortcuts,
      searchProps.recentQueries,
      searchProps.enableLocalHistory,
    ],
  );

  const showSuggestionsPopover = isFocused && suggestions.length > 0 && !disableGlobalShortcut;

  useEffect(() => {
    if (disableGlobalShortcut || searchProps.focusShortcut === 'none') return undefined;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingInInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      const allowCtrlK =
        searchProps.focusShortcut === 'ctrl+k' || searchProps.focusShortcut === 'both';
      const allowSlash = searchProps.focusShortcut === '/' || searchProps.focusShortcut === 'both';

      if (
        allowCtrlK &&
        (event.key === 'k' || event.key === 'K') &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (
        allowSlash &&
        event.key === '/' &&
        !isTypingInInput &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [disableGlobalShortcut, searchProps.focusShortcut]);

  const activeProviderMeta =
    searchProps.engine === 'custom'
      ? {
          id: 'custom' as const,
          label: 'Custom',
          placeholder: 'Search custom engine...',
          icon: 'tune',
        }
      : SEARCH_PROVIDERS[searchProps.engine];

  const handleSelectEngine = (engine: SearchEngineId) => {
    if (engine === 'custom') {
      if (!validateCustomSearchTemplate(searchProps.customEngineTemplate)) {
        setCustomTemplateDraft(
          searchProps.customEngineTemplate || 'https://kagi.com/search?q={query}',
        );
        setCustomTemplateError(null);
        setCustomDialogOpen(true);
        return;
      }
      void updateElementProps(elementId, {
        engine: 'custom',
        placeholder: 'Search custom engine...',
      });
      return;
    }

    void updateElementProps(elementId, {
      engine,
      placeholder: SEARCH_PROVIDERS[engine].placeholder,
    });
  };

  const handleSaveCustomTemplate = (event: FormEvent) => {
    event.preventDefault();
    const valid = validateCustomSearchTemplate(customTemplateDraft);
    if (!valid) {
      setCustomTemplateError(
        'Enter a valid http(s) URL with a valid domain and {query}, e.g. https://kagi.com/search?q={query}',
      );
      return;
    }
    setCustomTemplateError(null);
    setCustomDialogOpen(false);
    void updateElementProps(elementId, {
      engine: 'custom',
      customEngineTemplate: valid,
      placeholder: 'Search custom engine...',
    });
  };

  const executeNavigation = (url: string, submittedQuery?: string) => {
    if (submittedQuery && searchProps.enableLocalHistory && !disableGlobalShortcut) {
      const nextHistory = recordRecentSearchQuery(searchProps.recentQueries, submittedQuery);
      void updateElementProps(elementId, { recentQueries: nextHistory });
    }

    if (onNavigate) {
      onNavigate(url);
    } else {
      window.location.assign(url);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (
      showSuggestionsPopover &&
      activeSuggestionIdx >= 0 &&
      activeSuggestionIdx < suggestions.length
    ) {
      const chosen = suggestions[activeSuggestionIdx];
      if (chosen?.kind === 'shortcut') {
        executeNavigation(chosen.url);
        return;
      }
      if (chosen?.kind === 'history') {
        const histUrl = buildSearchUrl(
          chosen.query,
          searchProps.engine,
          searchProps.customEngineTemplate,
        );
        if (histUrl) {
          executeNavigation(histUrl, chosen.query);
        }
        return;
      }
    }

    const url = buildSearchUrl(query, searchProps.engine, searchProps.customEngineTemplate);
    if (!url) {
      if (searchProps.engine === 'custom' && query.trim().length > 0) {
        setCustomTemplateDraft(
          searchProps.customEngineTemplate || 'https://kagi.com/search?q={query}',
        );
        setCustomTemplateError('Configure a valid custom search URL containing {query}.');
        setCustomDialogOpen(true);
      }
      return;
    }

    executeNavigation(url, query);
  };

  const containerSurfaceClass =
    searchProps.visualStyle === 'solid'
      ? 'border border-[var(--aurora-border)] bg-[var(--aurora-surface-elevated)] shadow-[var(--glass-shadow)]'
      : 'aurora-glass';

  return (
    <div
      ref={containerRef}
      className={
        embeddedInCanvas ? 'relative flex h-full w-full items-center' : 'relative w-full max-w-2xl'
      }
    >
      <form
        role="search"
        aria-label="Web search"
        onSubmit={handleSubmit}
        className={`${containerSurfaceClass} group relative flex h-13 w-full items-center gap-1 rounded-full px-2 transition-all duration-[var(--aurora-duration-fast)] focus-within:border-[var(--aurora-border-highlight)] focus-within:shadow-[0_0_0_3px_rgba(117,207,255,0.14),var(--glass-shadow)] hover:border-[var(--aurora-border-highlight)] sm:h-14`}
      >
        {searchProps.showEngineSelector && (
          <>
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  aria-label={`Search provider: ${activeProviderMeta.label}`}
                  className="aurora-focus-ring inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--aurora-text-secondary)] transition-colors hover:bg-[var(--aurora-surface)] hover:text-[var(--aurora-text)]"
                >
                  <MaterialSymbol
                    name={activeProviderMeta.icon}
                    size={18}
                    className="text-[var(--aurora-primary)]"
                  />
                  <span className="hidden sm:inline">{activeProviderMeta.label}</span>
                  <MaterialSymbol name="expand_more" size={16} />
                </button>
              </DropdownTrigger>
              <DropdownContent align="start">
                {Object.values(SEARCH_PROVIDERS).map((provider) => (
                  <DropdownItem
                    key={provider.id}
                    icon={provider.icon}
                    selected={searchProps.engine === provider.id}
                    onSelect={() => handleSelectEngine(provider.id)}
                  >
                    {provider.label}
                  </DropdownItem>
                ))}
                <DropdownSeparator />
                <DropdownItem
                  icon="tune"
                  selected={searchProps.engine === 'custom'}
                  onSelect={() => {
                    setCustomTemplateDraft(
                      searchProps.customEngineTemplate || 'https://kagi.com/search?q={query}',
                    );
                    setCustomTemplateError(null);
                    setCustomDialogOpen(true);
                  }}
                >
                  Custom Search URL...
                </DropdownItem>
                <DropdownSeparator />
                <DropdownCheckboxItem
                  checked={searchProps.enableLocalHistory}
                  onCheckedChange={(checked) => {
                    const enabled = Boolean(checked);
                    void updateElementProps(
                      elementId,
                      enabled
                        ? { enableLocalHistory: true }
                        : { enableLocalHistory: false, recentQueries: [] },
                    );
                  }}
                >
                  Save local recent searches
                </DropdownCheckboxItem>
              </DropdownContent>
            </Dropdown>

            <div aria-hidden="true" className="h-5 w-px bg-[var(--aurora-border)]" />
          </>
        )}

        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget)) {
              setIsFocused(false);
              setActiveSuggestionIdx(-1);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveSuggestionIdx(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && suggestions.length > 0) {
              e.preventDefault();
              setActiveSuggestionIdx((prev) => (prev + 1) % suggestions.length);
              return;
            }
            if (e.key === 'ArrowUp' && suggestions.length > 0) {
              e.preventDefault();
              setActiveSuggestionIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
              return;
            }
            if (e.key === 'Escape') {
              if (query.length > 0) {
                setQuery('');
                setActiveSuggestionIdx(-1);
              } else {
                setIsFocused(false);
                inputRef.current?.blur();
              }
            }
          }}
          aria-label="Search query"
          aria-expanded={showSuggestionsPopover}
          placeholder={searchProps.placeholder || activeProviderMeta.placeholder}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] focus:outline-none sm:text-base"
        />

        {searchProps.showClearButton && query.length > 0 && (
          <IconButton
            icon="close"
            label="Clear search query"
            size="sm"
            iconSize={18}
            onClick={() => {
              setQuery('');
              setActiveSuggestionIdx(-1);
              inputRef.current?.focus();
            }}
            className="rounded-full"
          />
        )}

        {searchProps.showSearchIcon && (
          <IconButton
            type="submit"
            icon="search"
            label="Submit search"
            variant="primary"
            size="md"
            iconSize={20}
            className="shrink-0 rounded-full"
          />
        )}
      </form>

      {showSuggestionsPopover && (
        <div
          role="listbox"
          aria-label="Local search suggestions"
          className="aurora-glass-elevated absolute top-full right-2 left-2 z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--aurora-border)] py-1.5 shadow-[var(--glass-shadow)]"
        >
          {suggestions.map((item, idx) => {
            const isHighlighted = idx === activeSuggestionIdx;
            if (item.kind === 'shortcut') {
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeNavigation(item.url)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left text-xs transition-colors ${
                    isHighlighted
                      ? 'bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                      : 'text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface)]/70 hover:text-[var(--aurora-text)]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MaterialSymbol
                      name="open_in_new"
                      size={15}
                      className="shrink-0 text-[var(--aurora-primary)]"
                    />
                    <span className="truncate font-medium text-[var(--aurora-text)]">
                      {item.label}
                    </span>
                  </span>
                  <span className="max-w-44 truncate text-[11px] text-[var(--aurora-text-muted)]">
                    {item.subtitle}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={item.id}
                role="option"
                aria-selected={isHighlighted}
                className={`flex items-center justify-between gap-2 px-3.5 py-1.5 text-xs transition-colors ${
                  isHighlighted
                    ? 'bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                    : 'text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface)]/70 hover:text-[var(--aurora-text)]'
                }`}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery(item.query);
                    const url = buildSearchUrl(
                      item.query,
                      searchProps.engine,
                      searchProps.customEngineTemplate,
                    );
                    if (url) executeNavigation(url, item.query);
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                >
                  <MaterialSymbol
                    name="history"
                    size={15}
                    className="shrink-0 text-[var(--aurora-text-muted)]"
                  />
                  <span className="truncate">{item.label}</span>
                </button>
                <IconButton
                  icon="close"
                  label={`Remove recent query ${item.label}`}
                  size="sm"
                  iconSize={13}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const filtered = searchProps.recentQueries.filter((q) => q !== item.query);
                    void updateElementProps(elementId, { recentQueries: filtered });
                  }}
                  className="h-5 w-5 rounded-full"
                />
              </div>
            );
          })}

          {searchProps.enableLocalHistory && searchProps.recentQueries.length > 0 && (
            <div className="mt-1 flex items-center justify-between border-t border-[var(--aurora-border)] px-3.5 pt-1.5 text-[11px] text-[var(--aurora-text-muted)]">
              <span>Local only (never shared externally)</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void updateElementProps(elementId, { recentQueries: [] })}
                className="cursor-pointer font-medium text-[var(--aurora-primary)] hover:underline"
              >
                Clear history
              </button>
            </div>
          )}
        </div>
      )}

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Search Engine</DialogTitle>
            <DialogDescription>
              Provide an https:// search URL template containing <code>{'{query}'}</code>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCustomTemplate} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="custom-search-template"
                className="mb-1.5 block text-xs font-medium text-[var(--aurora-text-secondary)]"
              >
                Search URL Template
              </label>
              <Input
                id="custom-search-template"
                value={customTemplateDraft}
                onChange={(e) => {
                  setCustomTemplateDraft(e.target.value);
                  if (customTemplateError) setCustomTemplateError(null);
                }}
                invalid={Boolean(customTemplateError)}
                placeholder="https://kagi.com/search?q={query}"
              />
              {customTemplateError && (
                <p role="alert" className="mt-1.5 text-xs text-[var(--aurora-error)]">
                  {customTemplateError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Provider
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
