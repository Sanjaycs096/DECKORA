import { describe, expect, it } from 'vitest';
import {
  buildSearchUrl,
  getLocalSearchSuggestions,
  recordRecentSearchQuery,
  validateCustomSearchTemplate,
} from './searchProviders';

describe('Search Provider URL Builder & Validation', () => {
  it('builds encoded search URLs for Google, Bing, and DuckDuckGo', () => {
    expect(buildSearchUrl('aurora crystal', 'google')).toBe(
      'https://www.google.com/search?q=aurora%20crystal',
    );
    expect(buildSearchUrl('react & ts', 'bing')).toBe(
      'https://www.bing.com/search?q=react%20%26%20ts',
    );
    expect(buildSearchUrl('mv3 extension', 'duckduckgo')).toBe(
      'https://duckduckgo.com/?q=mv3%20extension',
    );
  });

  it('ignores empty or whitespace-only queries', () => {
    expect(buildSearchUrl('', 'google')).toBeNull();
    expect(buildSearchUrl('   \t  ', 'bing')).toBeNull();
  });

  it('validates custom search templates and rejects unsafe schemes', () => {
    expect(validateCustomSearchTemplate('https://kagi.com/search?q={query}')).toBe(
      'https://kagi.com/search?q={query}',
    );
    expect(validateCustomSearchTemplate('https://kagi.com/search')).toBeNull();
    expect(validateCustomSearchTemplate('javascript:alert({query})')).toBeNull();
    expect(validateCustomSearchTemplate('https://{query}/search')).toBeNull();
    expect(buildSearchUrl('test', 'custom', 'https://kagi.com/search?q={query}')).toBe(
      'https://kagi.com/search?q=test',
    );
  });

  it('builds offline local suggestions from shortcuts and opt-in history only', () => {
    const history = recordRecentSearchQuery(['chrome mv3'], 'vitest');
    expect(history).toEqual(['vitest', 'chrome mv3']);

    // Deduplicates case-insensitively and moves recent match to top
    const deduped = recordRecentSearchQuery(history, 'Chrome MV3');
    expect(deduped).toEqual(['Chrome MV3', 'vitest']);

    const suggestions = getLocalSearchSuggestions(
      'git',
      [
        {
          id: 'sc-gh',
          title: 'GitHub',
          url: 'https://github.com/',
          iconSource: 'favicon',
          materialSymbolName: null,
          monogramColor: '#75CFFF',
        },
      ],
      ['git rebase tutorial', 'vitest'],
      true,
    );

    expect(suggestions.map((s) => s.label)).toEqual(['GitHub', 'git rebase tutorial']);

    // When local history is disabled, history items do not appear
    const disabledHistory = getLocalSearchSuggestions(
      'git',
      [
        {
          id: 'sc-gh',
          title: 'GitHub',
          url: 'https://github.com/',
          iconSource: 'favicon',
          materialSymbolName: null,
          monogramColor: '#75CFFF',
        },
      ],
      ['git rebase tutorial'],
      false,
    );
    expect(disabledHistory.map((s) => s.label)).toEqual(['GitHub']);
  });
});
