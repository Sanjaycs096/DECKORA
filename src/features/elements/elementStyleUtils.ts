import type { ElementStyleBase, ImageShapeType } from '@/types/workspace';

export const IMAGE_SHAPE_OPTIONS: Array<{ value: ImageShapeType; label: string }> = [
  { value: 'rounded-rect', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'oval', label: 'Oval' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'star', label: 'Star' },
  { value: 'custom-rounded', label: 'Custom Corners' },
];

export function buildStarPolygonPoints(
  pointsCount: number,
  outerRadius = 0.49,
  innerRadius = 0.21,
): Array<[number, number]> {
  const safeCount = Math.min(12, Math.max(4, Math.round(pointsCount)));
  const coords: Array<[number, number]> = [];
  const totalVertices = safeCount * 2;

  for (let i = 0; i < totalVertices; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / safeCount;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = 0.5 + Math.cos(angle) * radius;
    const y = 0.5 + Math.sin(angle) * radius;
    coords.push([Number(x.toFixed(4)), Number(y.toFixed(4))]);
  }
  return coords;
}

export function buildPolygonPathNormalized(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
}

export function buildPolygonPath100(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  return (
    points
      .map(
        ([x, y], index) =>
          `${index === 0 ? 'M' : 'L'} ${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`,
      )
      .join(' ') + ' Z'
  );
}

export const DIAMOND_NORMALIZED_POINTS: Array<[number, number]> = [
  [0.5, 0.01],
  [0.99, 0.5],
  [0.5, 0.99],
  [0.01, 0.5],
];

export function isPolygonClippedShape(shape: ImageShapeType): boolean {
  return shape === 'diamond' || shape === 'star';
}

export function getElementDropShadowFilter(shadow: ElementStyleBase['shadow']): string | undefined {
  switch (shadow) {
    case 'soft':
      return 'drop-shadow(0 10px 22px rgba(4, 9, 20, 0.42))';
    case 'elevated':
      return 'drop-shadow(0 18px 36px rgba(4, 9, 20, 0.65))';
    case 'glow':
      return 'drop-shadow(0 0 22px rgba(117, 207, 255, 0.45)) drop-shadow(0 10px 24px rgba(4, 9, 20, 0.5))';
    case 'none':
    default:
      return undefined;
  }
}

export function getElementBoxShadowCss(shadow: ElementStyleBase['shadow']): string | undefined {
  switch (shadow) {
    case 'soft':
      return '0 10px 28px -6px rgba(4, 9, 20, 0.45)';
    case 'elevated':
      return '0 20px 48px -10px rgba(4, 9, 20, 0.68)';
    case 'glow':
      return '0 0 26px rgba(117, 207, 255, 0.4), 0 12px 28px -6px rgba(4, 9, 20, 0.52)';
    case 'none':
    default:
      return undefined;
  }
}

export function getCssBorderStyle(style: ElementStyleBase): {
  borderWidth: string;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'none';
} {
  if (style.borderStyle === 'none' || style.borderWidthPx <= 0) {
    return { borderWidth: '0px', borderColor: 'transparent', borderStyle: 'none' };
  }
  return {
    borderWidth: `${style.borderWidthPx}px`,
    borderColor: style.borderColor || 'rgba(229, 234, 242, 0.35)',
    borderStyle: style.borderStyle,
  };
}
