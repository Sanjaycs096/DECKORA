import type { ShortcutItem } from '@/types/workspace';
import { sanitizeHttpUrl } from '@/utils/url';

const MONOGRAM_PALETTE = [
  '#75CFFF',
  '#A78BFA',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#38BDF8',
  '#60A5FA',
] as const;

export function getExtensionFaviconUrl(pageUrl: string, size = 64): string | null {
  const safeUrl = sanitizeHttpUrl(pageUrl);
  if (!safeUrl) return null;

  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime?.id &&
    typeof chrome.runtime.getURL === 'function'
  ) {
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(safeUrl)}&size=${size}`);
  }
  return null;
}

export function normalizeShortcutUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ''}${path}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export interface ShortcutValidationResult {
  ok: true;
  title: string;
  url: string;
}

export interface ShortcutValidationError {
  ok: false;
  field: 'title' | 'url';
  message: string;
}

export interface ShortcutValidationOptions {
  existingItems?: ShortcutItem[];
  excludeId?: string;
}

export function validateShortcutForm(
  rawTitle: string,
  rawUrl: string,
  options?: ShortcutValidationOptions,
): ShortcutValidationResult | ShortcutValidationError {
  const title = rawTitle.trim();
  if (!title) {
    return { ok: false, field: 'title', message: 'Please enter a shortcut name.' };
  }
  if (title.length > 60) {
    return { ok: false, field: 'title', message: 'Name must be 60 characters or fewer.' };
  }

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return { ok: false, field: 'url', message: 'Please enter a website URL.' };
  }

  // Only prepend https:// when user entered a bare hostname without any scheme
  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedUrl);
  const candidate = hasExplicitScheme ? trimmedUrl : `https://${trimmedUrl}`;
  const safeUrl = sanitizeHttpUrl(candidate);

  if (!safeUrl) {
    return {
      ok: false,
      field: 'url',
      message: 'Enter a valid http:// or https:// website address.',
    };
  }

  try {
    const parsed = new URL(safeUrl);
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return {
        ok: false,
        field: 'url',
        message: 'Enter a valid domain name (e.g. https://github.com).',
      };
    }
  } catch {
    return { ok: false, field: 'url', message: 'Enter a valid website address.' };
  }

  if (options?.existingItems && options.existingItems.length > 0) {
    const targetNorm = normalizeShortcutUrl(safeUrl);
    const duplicate = options.existingItems.find(
      (item) => item.id !== options.excludeId && normalizeShortcutUrl(item.url) === targetNorm,
    );
    if (duplicate) {
      return {
        ok: false,
        field: 'url',
        message: `A shortcut for this URL already exists ("${duplicate.title}").`,
      };
    }
  }

  return { ok: true, title, url: safeUrl };
}

export function getShortcutMonogram(title: string, url: string): string {
  const cleanTitle = title.trim();
  if (cleanTitle.length > 0) {
    return cleanTitle.charAt(0).toUpperCase();
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.charAt(0).toUpperCase() || '?';
  } catch {
    return '?';
  }
}

export function pickMonogramColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return MONOGRAM_PALETTE[hash % MONOGRAM_PALETTE.length] ?? '#75CFFF';
}
