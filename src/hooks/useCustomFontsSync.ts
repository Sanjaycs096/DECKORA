import { useEffect } from 'react';
import { assetDb } from '@/services/assets/assetDb';
import { loadCustomFontIntoDocument } from '@/services/assets/mediaValidation';
import { useWorkspaceStore } from '@/state/workspaceStore';

/**
 * Loads persisted WOFF2/WOFF custom font buffers from IndexedDB into `document.fonts`
 * whenever workspace customFonts changes.
 */
export function useCustomFontsSync(): void {
  const customFonts = useWorkspaceStore((s) => s.workspace.globalSettings.customFonts);

  useEffect(() => {
    if (customFonts.length === 0) return;

    let cancelled = false;
    void Promise.all(
      customFonts.map(async (record) => {
        try {
          const stored = await assetDb.readFont(record.assetId);
          if (!stored || cancelled) return;
          await loadCustomFontIntoDocument(record.familyName, stored.buffer);
        } catch (error) {
          console.warn(`[DECKORA Fonts] Failed to load custom font "${record.familyName}":`, error);
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [customFonts]);
}
