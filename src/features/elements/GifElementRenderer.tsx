import { useRef, useState } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { IconButton } from '@/components/ui';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';
import { parseGifProps } from '@/services/storage/schemas';
import { usePreferencesStore } from '@/state/preferencesStore';
import type { GenericCanvasElement, GifElementProps } from '@/types/workspace';
import { getCssBorderStyle, getElementBoxShadowCss } from './elementStyleUtils';

export interface GifElementRendererProps {
  element: GenericCanvasElement;
  editPreview?: boolean;
}

function prefersReducedMotionActive(respectPreference: boolean): boolean {
  if (
    !respectPreference ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function GifElementBody({
  element,
  props,
  editPreview,
  respectReducedMotion,
}: {
  element: GenericCanvasElement;
  props: GifElementProps;
  editPreview: boolean;
  respectReducedMotion: boolean;
}) {
  const { url, status, errorMessage } = useAssetObjectUrl(props.assetId || null);

  const [localPausedOverride, setLocalPausedOverride] = useState<boolean | null>(null);
  const [frozenFrameUrl, setFrozenFrameUrl] = useState<string | null>(null);
  const [replayNonce, setReplayNonce] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const reducedMotionPause = prefersReducedMotionActive(respectReducedMotion);
  const isPaused = localPausedOverride ?? (props.paused || reducedMotionPause);

  const captureFrozenFrame = (): string | null => {
    const img = imgRef.current;
    if (!img || typeof document === 'undefined') return null;
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  };

  const handleTogglePlayPause = () => {
    if (isPaused) {
      setFrozenFrameUrl(null);
      setLocalPausedOverride(false);
    } else {
      const captured = captureFrozenFrame();
      setFrozenFrameUrl(captured);
      setLocalPausedOverride(true);
    }
  };

  const handleReplay = () => {
    setFrozenFrameUrl(null);
    setLocalPausedOverride(false);
    setReplayNonce((n) => n + 1);
  };

  const borderCss = getCssBorderStyle(element.style);
  const boxShadow = getElementBoxShadowCss(element.style.shadow);
  const borderRadius = `${Math.max(0, element.style.cornerRadiusPx)}px`;

  if (!props.assetId || status === 'missing' || status === 'error') {
    return (
      <div
        data-testid={`gif-fallback-${element.id}`}
        className="aurora-glass flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--aurora-warning)]/60 p-3 text-center"
      >
        <MaterialSymbol name="gif_box" size={26} className="text-[var(--aurora-warning)]" />
        <p className="text-xs font-medium text-[var(--aurora-text)]">{element.name}</p>
        <p className="line-clamp-2 text-[10px] text-[var(--aurora-text-muted)]">
          {errorMessage ?? 'GIF asset unavailable in local storage.'}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid={`gif-element-${element.id}`}
      data-gif-paused={isPaused ? 'true' : 'false'}
      className="group relative h-full w-full overflow-hidden"
      style={{
        borderRadius,
        boxShadow,
        ...borderCss,
      }}
    >
      {status === 'loading' || !url ? (
        <div className="aurora-glass flex h-full w-full items-center justify-center">
          <MaterialSymbol
            name="gif_box"
            size={28}
            className="animate-pulse text-[var(--aurora-text-muted)]"
          />
        </div>
      ) : (
        <>
          <img
            key={`${props.assetId}-${replayNonce}`}
            ref={imgRef}
            src={url}
            alt={props.altText}
            loading="lazy"
            draggable={false}
            className={`h-full w-full select-none ${isPaused && frozenFrameUrl ? 'opacity-0' : 'opacity-100'}`}
            style={{ objectFit: props.fit }}
          />

          {isPaused && frozenFrameUrl && (
            <img
              src={frozenFrameUrl}
              alt={`${props.altText} (paused frame)`}
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
              style={{ objectFit: props.fit }}
            />
          )}

          {isPaused && !frozenFrameUrl && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
            >
              <span className="aurora-glass inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--aurora-text)]">
                <MaterialSymbol name="pause" size={14} />
                Paused
              </span>
            </div>
          )}

          {!editPreview && (props.showControlsOnHover || isPaused) && (
            <div
              className={`absolute right-2 bottom-2 flex items-center gap-1 rounded-full border border-[var(--aurora-border)] bg-[var(--aurora-bg-elevated)]/90 p-1 shadow-md backdrop-blur-md transition-opacity duration-150 ${
                isPaused
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
              }`}
            >
              <IconButton
                icon={isPaused ? 'play_arrow' : 'pause'}
                label={isPaused ? `Play ${element.name}` : `Pause ${element.name}`}
                size="sm"
                iconSize={15}
                onClick={handleTogglePlayPause}
                className="h-6 w-6 rounded-full"
              />
              <IconButton
                icon="replay"
                label={`Replay ${element.name}`}
                size="sm"
                iconSize={15}
                onClick={handleReplay}
                className="h-6 w-6 rounded-full"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function GifElementRenderer({ element, editPreview = false }: GifElementRendererProps) {
  const props = parseGifProps(element.props);
  const respectReducedMotion = usePreferencesStore((s) => s.preferences.respectReducedMotion);

  return (
    <GifElementBody
      key={`${props.assetId}-${String(props.paused)}`}
      element={element}
      props={props}
      editPreview={editPreview}
      respectReducedMotion={respectReducedMotion}
    />
  );
}
