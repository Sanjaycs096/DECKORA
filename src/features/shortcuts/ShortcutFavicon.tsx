import { useState } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import type { ShortcutItem } from '@/types/workspace';
import { getExtensionFaviconUrl, getShortcutMonogram } from './shortcutUtils';

export interface ShortcutFaviconProps {
  shortcut: ShortcutItem;
  forceFallback?: boolean;
}

export function ShortcutFavicon({ shortcut, forceFallback = false }: ShortcutFaviconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const faviconUrl =
    !forceFallback && shortcut.iconSource === 'favicon'
      ? getExtensionFaviconUrl(shortcut.url)
      : null;

  if (faviconUrl && failedUrl !== faviconUrl) {
    return (
      <img
        src={faviconUrl}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(faviconUrl)}
        className="h-7 w-7 rounded-md object-contain"
      />
    );
  }

  if (shortcut.materialSymbolName) {
    return (
      <MaterialSymbol
        name={shortcut.materialSymbolName}
        size={24}
        style={{ color: shortcut.monogramColor }}
      />
    );
  }

  const letter = getShortcutMonogram(shortcut.title, shortcut.url);
  return (
    <span
      aria-hidden="true"
      className="font-[var(--font-display)] text-base font-semibold"
      style={{ color: shortcut.monogramColor }}
    >
      {letter}
    </span>
  );
}
