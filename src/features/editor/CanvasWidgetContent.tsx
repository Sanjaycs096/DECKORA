import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { LiveClock } from '@/features/clock/LiveClock';
import { GifElementRenderer } from '@/features/elements/GifElementRenderer';
import { ImageElementRenderer } from '@/features/elements/ImageElementRenderer';
import { TextElementRenderer } from '@/features/elements/TextElementRenderer';
import { SearchBar } from '@/features/search/SearchBar';
import { ShortcutsGrid } from '@/features/shortcuts/ShortcutsGrid';
import { SpeedMonitorWidget } from '@/features/speed/SpeedMonitorWidget';
import type { GenericCanvasElement } from '@/types/workspace';

export interface CanvasWidgetContentProps {
  element: GenericCanvasElement;
  editPreview?: boolean;
}

export function CanvasWidgetContent({ element, editPreview = false }: CanvasWidgetContentProps) {
  switch (element.type) {
    case 'clock':
      return (
        <WidgetErrorBoundary label={element.name}>
          <LiveClock
            elementId={element.id}
            propsOverride={element.props}
            editPreview={editPreview}
          />
        </WidgetErrorBoundary>
      );
    case 'search':
      return (
        <WidgetErrorBoundary label={element.name}>
          <SearchBar
            elementId={element.id}
            propsOverride={element.props}
            embeddedInCanvas
            disableGlobalShortcut={editPreview}
          />
        </WidgetErrorBoundary>
      );
    case 'shortcuts':
      return (
        <WidgetErrorBoundary label={element.name}>
          <ShortcutsGrid
            elementId={element.id}
            propsOverride={element.props}
            embeddedInCanvas
            editPreview={editPreview}
          />
        </WidgetErrorBoundary>
      );
    case 'speed':
      return (
        <WidgetErrorBoundary label={element.name}>
          <SpeedMonitorWidget element={element} editPreview={editPreview} />
        </WidgetErrorBoundary>
      );
    case 'image':
      return (
        <WidgetErrorBoundary label={element.name}>
          <ImageElementRenderer element={element} editPreview={editPreview} />
        </WidgetErrorBoundary>
      );
    case 'gif':
      return (
        <WidgetErrorBoundary label={element.name}>
          <GifElementRenderer element={element} editPreview={editPreview} />
        </WidgetErrorBoundary>
      );
    case 'text':
      return (
        <WidgetErrorBoundary label={element.name}>
          <TextElementRenderer element={element} editPreview={editPreview} />
        </WidgetErrorBoundary>
      );
    default:
      return (
        <div className="aurora-glass flex h-full w-full items-center justify-center rounded-2xl px-4 text-xs text-[var(--aurora-text-secondary)]">
          <span>{element.name}</span>
        </div>
      );
  }
}
