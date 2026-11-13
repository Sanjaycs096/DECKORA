import { useId } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';
import { parseImageProps } from '@/services/storage/schemas';
import type { GenericCanvasElement } from '@/types/workspace';
import {
  buildPolygonPath100,
  buildPolygonPathNormalized,
  buildStarPolygonPoints,
  DIAMOND_NORMALIZED_POINTS,
  getCssBorderStyle,
  getElementBoxShadowCss,
  getElementDropShadowFilter,
  isPolygonClippedShape,
} from './elementStyleUtils';

export interface ImageElementRendererProps {
  element: GenericCanvasElement;
  editPreview?: boolean;
}

export function ImageElementRenderer({ element }: ImageElementRendererProps) {
  const reactId = useId();
  const clipId = `aurora-img-clip-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const props = parseImageProps(element.props);
  const { url, status, errorMessage } = useAssetObjectUrl(props.assetId || null);

  const shadowFilter = getElementDropShadowFilter(element.style.shadow);
  const boxShadow = getElementBoxShadowCss(element.style.shadow);
  const borderCss = getCssBorderStyle(element.style);

  const isSquareFramed = props.shape === 'square' || props.shape === 'circle';
  const polygonClip = isPolygonClippedShape(props.shape);

  const polygonPoints =
    props.shape === 'diamond'
      ? DIAMOND_NORMALIZED_POINTS
      : buildStarPolygonPoints(props.starPoints);
  const clipPathD = buildPolygonPathNormalized(polygonPoints);
  const strokePathD = buildPolygonPath100(polygonPoints);

  let borderRadius = '0px';
  switch (props.shape) {
    case 'circle':
    case 'oval':
      borderRadius = '9999px';
      break;
    case 'rounded-rect':
      borderRadius = `${Math.max(0, element.style.cornerRadiusPx)}px`;
      break;
    case 'custom-rounded': {
      const [tl, tr, br, bl] = props.customCornerRadiiPx;
      borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
      break;
    }
    case 'square':
    case 'rectangle':
    case 'diamond':
    case 'star':
    default:
      borderRadius = '0px';
      break;
  }

  const imageTransformStyle = {
    objectFit: props.fit,
    objectPosition: `${props.crop.panXPct}% ${props.crop.panYPct}%`,
    transform: props.crop.zoom > 1 ? `scale(${props.crop.zoom})` : undefined,
    transformOrigin: `${props.crop.panXPct}% ${props.crop.panYPct}%`,
  } as const;

  if (!props.assetId || status === 'missing' || status === 'error') {
    return (
      <div
        data-testid={`image-fallback-${element.id}`}
        className="aurora-glass flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--aurora-warning)]/60 p-3 text-center"
      >
        <MaterialSymbol name="broken_image" size={26} className="text-[var(--aurora-warning)]" />
        <p className="text-xs font-medium text-[var(--aurora-text)]">{element.name}</p>
        <p className="line-clamp-2 text-[10px] text-[var(--aurora-text-muted)]">
          {errorMessage ?? 'Image asset unavailable in local storage.'}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid={`image-element-${element.id}`}
      data-image-shape={props.shape}
      className="flex h-full w-full items-center justify-center"
      style={{
        filter: polygonClip ? shadowFilter : undefined,
      }}
    >
      <div
        className={`relative overflow-hidden ${isSquareFramed ? 'aspect-square max-h-full max-w-full h-full w-auto' : 'h-full w-full'}`}
        style={{
          borderRadius: polygonClip ? undefined : borderRadius,
          boxShadow: polygonClip ? undefined : boxShadow,
          ...(polygonClip ? {} : borderCss),
          clipPath: polygonClip ? `url(#${clipId})` : undefined,
        }}
      >
        {polygonClip && (
          <svg
            aria-hidden="true"
            width="0"
            height="0"
            className="pointer-events-none absolute h-0 w-0"
          >
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                <path d={clipPathD} />
              </clipPath>
            </defs>
          </svg>
        )}

        {status === 'loading' || !url ? (
          <div className="aurora-glass flex h-full w-full items-center justify-center">
            <MaterialSymbol
              name="image"
              size={24}
              className="animate-pulse text-[var(--aurora-text-muted)]"
            />
          </div>
        ) : (
          <img
            src={url}
            alt={props.altText}
            draggable={false}
            className="h-full w-full select-none transition-transform duration-150"
            style={imageTransformStyle}
          />
        )}

        {polygonClip && element.style.borderStyle !== 'none' && element.style.borderWidthPx > 0 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <path
              d={strokePathD}
              fill="none"
              stroke={element.style.borderColor || 'rgba(229, 234, 242, 0.5)'}
              strokeWidth={element.style.borderWidthPx * 1.4}
              strokeDasharray={element.style.borderStyle === 'dashed' ? '4 2.5' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
