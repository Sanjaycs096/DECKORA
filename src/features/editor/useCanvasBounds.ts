import { useEffect, useState, type RefObject } from 'react';
import type { CanvasDimensions } from './geometry';

function getFallbackCanvasDimensions(): CanvasDimensions {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 844 };
  }
  return {
    width: Math.max(320, window.innerWidth || 1440),
    height: Math.max(400, (window.innerHeight || 900) - 56),
  };
}

export function useCanvasBounds(containerRef: RefObject<HTMLDivElement | null>): CanvasDimensions {
  const [bounds, setBounds] = useState<CanvasDimensions>(getFallbackCanvasDimensions);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateBounds = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 320 && rect.height >= 240) {
        setBounds({ width: rect.width, height: rect.height });
      } else {
        setBounds(getFallbackCanvasDimensions());
      }
    };

    updateBounds();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateBounds();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [containerRef]);

  return bounds;
}
