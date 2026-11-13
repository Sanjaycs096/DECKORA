import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui';
import { getContrastRatio, resolveThemePalette } from '@/design-system/themeEngine';
import { DECKORA_SEED_PALETTE } from '@/design-system/tokens';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import {
  createDefaultThemeConfig,
  createDefaultWallpaperConfig,
} from '@/services/storage/defaults';
import { WallpaperDialog } from '@/features/wallpaper/WallpaperDialog';
import { useThemeStore } from '@/state/themeStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import {
  ensureWcagContrast,
  extractPaletteFromRgbaPixels,
  extractPaletteFromWallpaper,
} from './adaptivePalette';

function createMemoryStorageService(): ChromeStorageService {
  const store = new Map<string, unknown>();
  const adapter: StorageBackendAdapter = {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
  return new ChromeStorageService(adapter);
}

describe('Phase 6 — Local Adaptive Wallpaper Palette & Contrast Guard', () => {
  beforeEach(async () => {
    const storage = createMemoryStorageService();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useThemeStore.setState(useThemeStore.getInitialState());
    await useWorkspaceStore.getState().hydrate(storage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts dark-recommended palette with >= 4.5:1 WCAG contrast from deep twilight pixels', () => {
    // 4x4 grid mixing deep navy background (#14203B) and warm coral sunset accents (#F97316, #38BDF8)
    const pixels = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i += 1) {
      const idx = i * 4;
      if (i < 11) {
        pixels[idx] = 20;
        pixels[idx + 1] = 32;
        pixels[idx + 2] = 59;
        pixels[idx + 3] = 255;
      } else if (i < 14) {
        pixels[idx] = 249;
        pixels[idx + 1] = 115;
        pixels[idx + 2] = 22;
        pixels[idx + 3] = 255;
      } else {
        pixels[idx] = 56;
        pixels[idx + 1] = 189;
        pixels[idx + 2] = 248;
        pixels[idx + 3] = 255;
      }
    }

    const palette = extractPaletteFromRgbaPixels(
      { data: pixels, width: 4, height: 4 },
      'image:twilight-1',
    );

    expect(palette.recommendedAppearance).toBe('dark');
    expect(palette.averageLuminance).toBeLessThan(0.45);
    expect(palette.sourceSignature).toBe('image:twilight-1');
    expect(palette.bgCanvas).toBeDefined();
    expect(getContrastRatio(palette.accent, palette.bgCanvas!)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(palette.secondaryAccent!, palette.bgCanvas!)).toBeGreaterThanOrEqual(
      4.5,
    );

    // Ensure resolveThemePalette maintains accessible text contrast cleanly
    const theme = {
      ...createDefaultThemeConfig(),
      appearance: 'system' as const,
      accentColor: palette.accent,
      secondaryAccentColor: palette.secondaryAccent!,
      useWallpaperAdaptivePalette: true,
      extractedPalette: palette,
    };
    const resolved = resolveThemePalette(theme, false);
    expect(resolved.resolvedAppearance).toBe('dark');
    expect(getContrastRatio(resolved.tokens.textPrimary, resolved.tokens.bgCanvas)).toBeGreaterThan(
      8,
    );
  });

  it('recommends light appearance and darkens bright accents to preserve contrast on bright imagery', () => {
    const pixels = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i += 1) {
      const idx = i * 4;
      if (i < 12) {
        pixels[idx] = 244;
        pixels[idx + 1] = 248;
        pixels[idx + 2] = 254;
        pixels[idx + 3] = 255;
      } else {
        // Very pale cyan that must be darkened for contrast against light bgCanvas
        pixels[idx] = 180;
        pixels[idx + 1] = 230;
        pixels[idx + 2] = 250;
        pixels[idx + 3] = 255;
      }
    }

    const palette = extractPaletteFromRgbaPixels(
      { data: pixels, width: 4, height: 4 },
      'image:bright-sky',
    );
    expect(palette.recommendedAppearance).toBe('light');
    expect(palette.averageLuminance).toBeGreaterThan(0.45);
    expect(getContrastRatio(palette.accent, palette.bgCanvas!)).toBeGreaterThanOrEqual(4.5);

    // Direct WCAG nudging verification
    const fixedLightAccent = ensureWcagContrast('#CBD5E1', '#F1F5F9', 4.5, 'light');
    expect(getContrastRatio(fixedLightAccent, '#F1F5F9')).toBeGreaterThanOrEqual(4.5);
  });

  it('extracts locally from image blobs via injected pixel decoder and gradient presets with zero network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const imgWallpaper = {
      ...createDefaultWallpaperConfig(),
      type: 'image' as const,
      assetId: 'asset-local-photo',
    };

    const customPixels = new Uint8ClampedArray([
      15, 23, 42, 255, 117, 207, 255, 255, 167, 139, 250, 255,
    ]);
    const extracted = await extractPaletteFromWallpaper(imgWallpaper, {
      imageBlob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], {
        type: 'image/png',
      }),
      decodeImagePixels: () => Promise.resolve({ data: customPixels, width: 3, height: 1 }),
    });

    expect(extracted.sourceSignature).toBe('image:asset-local-photo');
    expect(fetchSpy).not.toHaveBeenCalled();

    const gradExtracted = await extractPaletteFromWallpaper(createDefaultWallpaperConfig());
    expect(gradExtracted.sourceSignature?.startsWith('gradient:')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lets users extract, live-preview, revert, or apply adaptive palette inside WallpaperDialog', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <WallpaperDialog open onOpenChange={() => {}} />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Extract Palette/i }));

    await waitFor(() => {
      expect(screen.getByText(/Live Preview Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Dominant/i)).toBeInTheDocument();
    });

    // Clicking Revert Default Colors restores Deckora Royal Crystal seed palette live
    await user.click(screen.getByRole('button', { name: /Revert Default Colors/i }));
    expect(useThemeStore.getState().theme.accentColor).toBe(DECKORA_SEED_PALETTE.iceBlue);
    expect(useThemeStore.getState().theme.useWallpaperAdaptivePalette).toBe(false);
  });
});
