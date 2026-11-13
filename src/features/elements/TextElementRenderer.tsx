import { useEffect } from 'react';
import { assetDb } from '@/services/assets/assetDb';
import { loadCustomFontIntoDocument } from '@/services/assets/mediaValidation';
import { parseTextProps } from '@/services/storage/schemas';
import type { GenericCanvasElement, TextElementProps } from '@/types/workspace';
import { getCssBorderStyle, getElementBoxShadowCss } from './elementStyleUtils';

export interface TextElementRendererProps {
  element: GenericCanvasElement;
  editPreview?: boolean;
}

function getTextShadowCss(mode: TextElementProps['textShadow']): string | undefined {
  switch (mode) {
    case 'subtle':
      return '0 2px 10px rgba(4, 9, 20, 0.42)';
    case 'crisp':
      return '0 1px 2px rgba(4, 9, 20, 0.85), 0 4px 14px rgba(4, 9, 20, 0.45)';
    case 'none':
    default:
      return undefined;
  }
}

function hexToRgba(color: string, opacity: number): string {
  const cleaned = color.trim();
  const hex3 = /^#([0-9a-fA-F]{3})$/.exec(cleaned);
  if (hex3) {
    const [r, g, b] = hex3[1]!.split('').map((ch) => parseInt(ch + ch, 16));
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  const hex6 = /^#([0-9a-fA-F]{6})$/.exec(cleaned);
  if (hex6) {
    const raw = hex6[1]!;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

export function TextElementRenderer({ element }: TextElementRendererProps) {
  const props = parseTextProps(element.props);

  useEffect(() => {
    const fontAssetId = props.uploadedFontAssetId;
    if (!fontAssetId) return;

    let cancelled = false;
    void assetDb
      .readFont(fontAssetId)
      .then((stored) => {
        if (!stored || cancelled) return;
        return loadCustomFontIntoDocument(stored.familyName, stored.buffer);
      })
      .catch(() => {
        // Fallback silently to system sans if custom font binary is missing
      });

    return () => {
      cancelled = true;
    };
  }, [props.uploadedFontAssetId]);

  const borderCss = getCssBorderStyle(element.style);
  const boxShadow = getElementBoxShadowCss(element.style.shadow);
  const borderRadius = `${Math.max(0, element.style.cornerRadiusPx)}px`;

  const justifyContent =
    props.alignment === 'left' ? 'flex-start' : props.alignment === 'right' ? 'flex-end' : 'center';

  const containerBgStyle =
    props.backgroundStyle === 'solid'
      ? { backgroundColor: hexToRgba(props.backgroundColor, props.backgroundOpacity) }
      : {};

  return (
    <div
      data-testid={`text-element-${element.id}`}
      className={`flex h-full w-full items-center overflow-hidden ${
        props.backgroundStyle === 'crystal' ? 'aurora-glass' : ''
      }`}
      style={{
        justifyContent,
        padding: `${props.paddingPx}px`,
        borderRadius,
        boxShadow,
        ...borderCss,
        ...containerBgStyle,
      }}
    >
      <p
        className="w-full break-words whitespace-pre-wrap select-none"
        style={{
          fontFamily: `${props.fontFamily}, "Inter Variable", system-ui, sans-serif`,
          fontSize: `${props.fontSizePx}px`,
          fontWeight: props.fontWeight,
          fontStyle: props.italic ? 'italic' : 'normal',
          textDecoration: props.underline ? 'underline' : 'none',
          color: props.color,
          opacity: props.opacity,
          textAlign: props.alignment,
          letterSpacing: `${props.letterSpacingEm}em`,
          lineHeight: props.lineHeight,
          textShadow: getTextShadowCss(props.textShadow),
        }}
      >
        {props.content.length > 0 ? props.content : ' '}
      </p>
    </div>
  );
}
