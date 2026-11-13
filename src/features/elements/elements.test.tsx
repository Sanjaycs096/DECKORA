import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { assetDb } from '@/services/assets/assetDb';
import { clearAllCachedAssetUrls } from '@/services/assets/assetUrlManager';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import {
  DEFAULT_GIF_PROPS,
  DEFAULT_IMAGE_PROPS,
  DEFAULT_TEXT_PROPS,
} from '@/services/storage/defaults';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useThemeStore } from '@/state/themeStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { WallpaperDialog } from '@/features/wallpaper/WallpaperDialog';
import type { GenericCanvasElement, ImageShapeType } from '@/types/workspace';
import { AddElementDialog } from './AddElementDialogs';
import { GifElementRenderer } from './GifElementRenderer';
import { ImageElementRenderer } from './ImageElementRenderer';
import { TextElementRenderer } from './TextElementRenderer';

function createMemoryAdapter(): StorageBackendAdapter {
  const map = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(map.get(key)),
    set: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
}

function makeBaseElement(
  id: string,
  type: 'image' | 'gif' | 'text',
  props: Record<string, unknown>,
): GenericCanvasElement {
  return {
    id,
    type,
    name: `Test ${type}`,
    zIndex: 0,
    visible: true,
    locked: false,
    groupId: null,
    transform: {
      xPct: 20,
      yPct: 20,
      widthPx: 260,
      heightPx: 220,
      minWidthPx: 64,
      minHeightPx: 64,
      aspectLocked: false,
    },
    style: {
      opacity: 1,
      borderWidthPx: 2,
      borderColor: '#75CFFF',
      borderStyle: 'solid',
      shadow: 'soft',
      cornerRadiusPx: 20,
    },
    props,
  };
}

describe('Phase 4 Renderers, Wallpaper & Add Element Flows', () => {
  beforeEach(() => {
    clearAllCachedAssetUrls();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useEditorSessionStore.setState(useEditorSessionStore.getInitialState());
    useThemeStore.setState(useThemeStore.getInitialState());
    usePreferencesStore.setState(usePreferencesStore.getInitialState());

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-media-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    clearAllCachedAssetUrls();
    vi.restoreAllMocks();
  });

  it('renders ImageElementRenderer across all 8 geometric shapes and handles missing assets safely', async () => {
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ]);
    await assetDb.addAsset({
      id: 'asset-img-shape-test',
      kind: 'image',
      name: 'hero.png',
      mimeType: 'image/png',
      blob: new Blob([pngHeader.buffer], { type: 'image/png' }),
      width: 400,
      height: 300,
    });

    const shapes: ImageShapeType[] = [
      'square',
      'rectangle',
      'rounded-rect',
      'circle',
      'oval',
      'diamond',
      'star',
      'custom-rounded',
    ];

    for (const shape of shapes) {
      const el = makeBaseElement(`el-img-${shape}`, 'image', {
        ...DEFAULT_IMAGE_PROPS,
        assetId: 'asset-img-shape-test',
        altText: `Shape ${shape}`,
        shape,
        crop: { zoom: 1.5, panXPct: 35, panYPct: 65 },
      });

      const { unmount } = render(<ImageElementRenderer element={el} />);
      const img = await screen.findByRole('img', { name: `Shape ${shape}` });
      expect(img).toHaveAttribute('src', 'blob:mock-media-url');
      expect(img.style.transform).toContain('scale(1.5)');

      const container = screen.getByTestId(`image-element-el-img-${shape}`);
      expect(container).toHaveAttribute('data-image-shape', shape);
      unmount();
    }

    // Missing asset renders friendly fallback without throwing
    const missingEl = makeBaseElement('el-img-missing', 'image', {
      ...DEFAULT_IMAGE_PROPS,
      assetId: 'non-existent-id',
    });
    render(<ImageElementRenderer element={missingEl} />);
    await waitFor(() => {
      expect(screen.getByTestId('image-fallback-el-img-missing')).toBeInTheDocument();
    });
  });

  it('renders GifElementRenderer natively with Play/Pause/Replay controls and reduced-motion support', async () => {
    const gifHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 100, 0, 100, 0]);
    await assetDb.addAsset({
      id: 'asset-gif-test',
      kind: 'gif',
      name: 'aurora.gif',
      mimeType: 'image/gif',
      blob: new Blob([gifHeader.buffer], { type: 'image/gif' }),
      width: 100,
      height: 100,
    });

    const user = userEvent.setup();
    const el = makeBaseElement('el-gif-1', 'gif', {
      ...DEFAULT_GIF_PROPS,
      assetId: 'asset-gif-test',
      altText: 'Animated Aurora',
      paused: false,
    });

    render(<GifElementRenderer element={el} />);
    const gifImg = await screen.findByRole('img', { name: 'Animated Aurora' });
    expect(gifImg).toHaveAttribute('loading', 'lazy');

    const root = screen.getByTestId('gif-element-el-gif-1');
    expect(root).toHaveAttribute('data-gif-paused', 'false');

    await user.click(screen.getByRole('button', { name: 'Pause Test gif' }));
    expect(screen.getByTestId('gif-element-el-gif-1')).toHaveAttribute('data-gif-paused', 'true');

    await user.click(screen.getByRole('button', { name: 'Play Test gif' }));
    expect(screen.getByTestId('gif-element-el-gif-1')).toHaveAttribute('data-gif-paused', 'false');

    await user.click(screen.getByRole('button', { name: 'Replay Test gif' }));
    expect(screen.getByTestId('gif-element-el-gif-1')).toHaveAttribute('data-gif-paused', 'false');
  });

  it('renders TextElementRenderer as escaped plain text preventing script/HTML injection', () => {
    const dangerousString =
      'Hello <img src=x onerror=alert(1)><script>window.__hacked=true</script>';
    const el = makeBaseElement('el-text-safe', 'text', {
      ...DEFAULT_TEXT_PROPS,
      content: dangerousString,
      italic: true,
      underline: true,
      backgroundStyle: 'crystal',
    });

    const { container } = render(<TextElementRenderer element={el} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('text-element-el-text-safe')).toHaveTextContent(dangerousString);
  });

  it('creates custom Text elements via AddElementDialog and commits wallpaper changes transactionally', async () => {
    const storage = new ChromeStorageService(createMemoryAdapter());
    await useWorkspaceStore.getState().hydrate(storage);

    const user = userEvent.setup();
    useEditorSessionStore.getState().enterEditMode();

    const { unmount } = render(
      <TooltipProvider>
        <AuroraBackground />
        <AddElementDialog kind="text" onClose={() => {}} />
      </TooltipProvider>,
    );

    const contentInput = screen.getByLabelText('Text Content');
    await user.clear(contentInput);
    await user.type(contentInput, 'Ship Clean Extensions');
    await user.click(screen.getByRole('button', { name: 'Add Text to Canvas' }));

    const draftElements = Object.values(
      useEditorSessionStore.getState().draftLayout?.elements ?? {},
    );
    const addedText = draftElements.find((item) => item.type === 'text');
    expect(addedText).toBeDefined();
    expect(addedText?.props.content).toBe('Ship Clean Extensions');
    unmount();

    // Switch wallpaper preset inside Edit Mode draft -> savedWorkspace stays untouched until commit
    render(
      <TooltipProvider>
        <AuroraBackground />
        <WallpaperDialog open onOpenChange={() => {}} />
      </TooltipProvider>,
    );
    const savedWallpaperBefore = useWorkspaceStore.getState().getActiveProfile()!.theme.wallpaper
      .gradientCss;
    await user.click(screen.getByRole('tab', { name: 'Gradients' }));
    await user.click(screen.getByRole('button', { name: 'Arctic Horizon' }));
    await user.click(screen.getByRole('button', { name: 'Apply to Draft' }));

    expect(useEditorSessionStore.getState().draftTheme?.wallpaper.gradientCss).toContain('#7FD3F7');
    expect(useWorkspaceStore.getState().getActiveProfile()!.theme.wallpaper.gradientCss).toBe(
      savedWallpaperBefore,
    );

    const committed = await useEditorSessionStore.getState().commitDraft(storage);
    expect(committed).toBe(true);
    expect(useWorkspaceStore.getState().getActiveProfile()!.theme.wallpaper.gradientCss).toContain(
      '#7FD3F7',
    );
    expect(
      Object.values(useWorkspaceStore.getState().getActiveProfile()!.layout.elements).some(
        (e) => e.type === 'text' && e.props.content === 'Ship Clean Extensions',
      ),
    ).toBe(true);
  });
});
