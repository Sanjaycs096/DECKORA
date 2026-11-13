import { useRef } from 'react';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { CanvasWidgetContent } from './CanvasWidgetContent';
import { transformToScreenRect } from './geometry';
import { useCanvasBounds } from './useCanvasBounds';

export function WorkspaceViewCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasBounds = useCanvasBounds(containerRef);
  const layout = useWorkspaceStore(
    (s) => s.workspace.profiles[s.workspace.activeProfileId]?.layout,
  );

  if (!layout) return null;

  const isCompactStack = canvasBounds.width < 560;

  return (
    <main
      ref={containerRef}
      aria-label="Workspace canvas"
      className={
        isCompactStack
          ? 'relative mt-14 flex min-h-[calc(100dvh-3.5rem)] w-full flex-1 flex-col items-center gap-6 px-4 py-6'
          : 'relative mt-14 h-[calc(100dvh-3.5rem)] w-full overflow-hidden'
      }
    >
      {layout.zOrder.map((id, orderIndex) => {
        const element = layout.elements[id];
        if (!element || !element.visible) return null;

        if (isCompactStack) {
          return (
            <div key={id} data-canvas-element-id={id} className="w-full max-w-md">
              <CanvasWidgetContent element={element} />
            </div>
          );
        }

        const rect = transformToScreenRect(
          element.transform,
          canvasBounds,
          layout.referenceViewport,
        );

        return (
          <div
            key={id}
            data-canvas-element-id={id}
            className="absolute"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              zIndex: orderIndex + 1,
              opacity: element.style.opacity,
            }}
          >
            <CanvasWidgetContent element={element} />
          </div>
        );
      })}
    </main>
  );
}
