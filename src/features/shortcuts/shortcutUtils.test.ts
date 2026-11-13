import { describe, expect, it } from 'vitest';
import { getShortcutMonogram, normalizeShortcutUrl, validateShortcutForm } from './shortcutUtils';

describe('Shortcut URL Validation & Monogram Helpers', () => {
  it('accepts valid http/https URLs and auto-prepends https:// for bare domains', () => {
    expect(validateShortcutForm('GitHub', 'https://github.com')).toEqual({
      ok: true,
      title: 'GitHub',
      url: 'https://github.com/',
    });

    expect(validateShortcutForm('Example', 'example.com/docs')).toEqual({
      ok: true,
      title: 'Example',
      url: 'https://example.com/docs',
    });
  });

  it('rejects empty inputs, malformed domains, and unsafe schemes', () => {
    expect(validateShortcutForm('', 'https://github.com').ok).toBe(false);
    expect(validateShortcutForm('Bad', '').ok).toBe(false);
    expect(validateShortcutForm('XSS', 'javascript:alert(1)').ok).toBe(false);
    expect(validateShortcutForm('Data', 'data:text/html,<script>').ok).toBe(false);
    expect(validateShortcutForm('FTP', 'ftp://files.example.com').ok).toBe(false);
    expect(validateShortcutForm('NoTld', 'notadomain').ok).toBe(false);
  });

  it('computes clean fallback monograms', () => {
    expect(getShortcutMonogram('GitHub', 'https://github.com')).toBe('G');
    expect(getShortcutMonogram('', 'https://www.youtube.com')).toBe('Y');
  });

  it('normalizes URLs cleanly and detects duplicate shortcuts on add vs edit', () => {
    expect(normalizeShortcutUrl('https://GitHub.com/')).toBe('https://github.com');
    expect(normalizeShortcutUrl('https://github.com/org/')).toBe('https://github.com/org');

    const existing = [
      {
        id: 'sc-github',
        title: 'GitHub',
        url: 'https://github.com/',
        iconSource: 'favicon' as const,
        materialSymbolName: null,
        monogramColor: '#75CFFF',
      },
    ];

    // Adding a duplicate URL with trailing slash or casing variant fails
    const dupAdd = validateShortcutForm('GitHub Mirror', 'https://GITHUB.com', {
      existingItems: existing,
    });
    expect(dupAdd.ok).toBe(false);

    // Editing the same shortcut allows its own URL via excludeId
    const selfEdit = validateShortcutForm('GitHub Enterprise', 'https://github.com/', {
      existingItems: existing,
      excludeId: 'sc-github',
    });
    expect(selfEdit.ok).toBe(true);
  });
});
