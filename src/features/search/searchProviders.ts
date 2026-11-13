import type { SearchEngineId, ShortcutItem } from '@/types/workspace';
import { sanitizeHttpUrl } from '@/utils/url';

export interface SearchProviderMeta {
  id: SearchEngineId;
  label: string;
  placeholder: string;
  icon: string;
  template: string;
}

export const SEARCH_PROVIDERS: Record<Exclude<SearchEngineId, 'custom'>, SearchProviderMeta> = {
  google: {
    id: 'google',
    label: 'Google',
    placeholder: 'Search Google...',
    icon: 'travel_explore',
    template: 'https://www.google.com/search?q={query}',
  },
  bing: {
    id: 'bing',
    label: 'Bing',
    placeholder: 'Search Bing...',
    icon: 'manage_search',
    template: 'https://www.bing.com/search?q={query}',
  },
  duckduckgo: {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    placeholder: 'Search DuckDuckGo...',
    icon: 'shield_lock',
    template: 'https://duckduckgo.com/?q={query}',
  },
};

export function validateCustomSearchTemplate(rawTemplate: string): string | null {
  const trimmed = rawTemplate.trim();
  if (!trimmed || !trimmed.includes('{query}')) {
    return null;
  }
  const probeUrl = trimmed.replaceAll('{query}', 'aurora');
  const sanitized = sanitizeHttpUrl(probeUrl);
  if (!sanitized) {
    return null;
  }
  try {
    const parsed = new URL(sanitized);
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return null;
    }
  } catch {
    return null;
  }
  return trimmed;
}

export function buildSearchUrl(
  rawQuery: string,
  engine: SearchEngineId,
  customTemplate?: string,
): string | null {
  const query = rawQuery.trim();
  if (!query) {
    return null;
  }

  const encoded = encodeURIComponent(query);

  if (engine === 'custom') {
    const validTemplate = customTemplate ? validateCustomSearchTemplate(customTemplate) : null;
    if (!validTemplate) {
      return null;
    }
    const candidate = validTemplate.replaceAll('{query}', encoded);
    return sanitizeHttpUrl(candidate);
  }

  const template = SEARCH_PROVIDERS[engine].template;
  return sanitizeHttpUrl(template.replaceAll('{query}', encoded));
}

export function recordRecentSearchQuery(
  existing: string[],
  rawQuery: string,
  maxItems = 8,
): string[] {
  const trimmed = rawQuery.trim().slice(0, 120);
  if (!trimmed) return existing;
  const deduped = existing.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...deduped].slice(0, maxItems);
}

export type LocalSuggestionItem =
  | {
      kind: 'shortcut';
      id: string;
      label: string;
      subtitle: string;
      url: string;
    }
  | {
      kind: 'history';
      id: string;
      label: string;
      query: string;
    };

export function getLocalSearchSuggestions(
  rawQuery: string,
  shortcuts: ShortcutItem[],
  recentQueries: string[],
  enableLocalHistory: boolean,
): LocalSuggestionItem[] {
  const normalized = rawQuery.trim().toLowerCase();
  const suggestions: LocalSuggestionItem[] = [];

  if (normalized.length > 0 && shortcuts.length > 0) {
    for (const sc of shortcuts) {
      const safeUrl = sanitizeHttpUrl(sc.url);
      if (!safeUrl) continue;
      if (
        sc.title.toLowerCase().includes(normalized) ||
        safeUrl.toLowerCase().includes(normalized)
      ) {
        suggestions.push({
          kind: 'shortcut',
          id: `sc-${sc.id}`,
          label: sc.title,
          subtitle: safeUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
          url: safeUrl,
        });
      }
      if (suggestions.length >= 4) break;
    }
  }

  if (enableLocalHistory && recentQueries.length > 0) {
    const matchingHistory = normalized
      ? recentQueries.filter((item) => item.toLowerCase().includes(normalized))
      : recentQueries;
    for (const q of matchingHistory.slice(0, 4)) {
      suggestions.push({
        kind: 'history',
        id: `hist-${q}`,
        label: q,
        query: q,
      });
      if (suggestions.length >= 7) break;
    }
  }

  return suggestions;
}
