import { useState, type FormEvent } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { Button, IconButton, Input, Switch } from '@/components/ui';
import { WallpaperDialog } from '@/features/wallpaper/WallpaperDialog';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import type { AppearanceMode } from '@/types/workspace';
import {
  ClockInspectorSection,
  ElementStyleInspectorSection,
  GifInspectorSection,
  ImageInspectorSection,
  SearchInspectorSection,
  ShortcutsInspectorSection,
  SpeedInspectorSection,
  TextInspectorSection,
} from './ElementInspectorSections';
import {
  roundPrecision,
  transformToScreenRect,
  getRectUnion,
  type CanvasDimensions,
  type ScreenRect,
} from './geometry';
import { canGroupSelection, canUngroupSelection, getUnlockedIds } from './layoutOps';

interface NumericFieldProps {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onCommit: (nextValue: number) => void;
}

function NumericInspectorField({
  id,
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  disabled = false,
  onCommit,
}: NumericFieldProps) {
  const [rawText, setRawText] = useState(() => String(roundPrecision(value, 2)));
  const [error, setError] = useState<string | null>(null);

  const tryCommit = () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setError(`${label} is required.`);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setError(`${label} must be a valid number.`);
      return;
    }
    if (parsed < min || parsed > max) {
      setError(`${label} must be between ${min} and ${max}${unit}.`);
      return;
    }
    setError(null);
    if (roundPrecision(parsed, 2) !== roundPrecision(value, 2)) {
      onCommit(roundPrecision(parsed, 2));
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    tryCommit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <label
        htmlFor={id}
        className="flex items-center justify-between text-[11px] font-medium text-[var(--aurora-text-secondary)]"
      >
        <span>{label}</span>
        <span className="text-[10px] text-[var(--aurora-text-muted)]">{unit}</span>
      </label>
      <Input
        id={id}
        type="number"
        step={step}
        value={rawText}
        disabled={disabled}
        invalid={Boolean(error)}
        onChange={(e) => {
          setRawText(e.target.value);
          if (error) setError(null);
        }}
        onBlur={tryCommit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setRawText(String(roundPrecision(value, 2)));
            setError(null);
          }
        }}
        className="h-8 px-2.5 text-xs tabular-nums"
      />
      {error && (
        <p role="alert" className="text-[10px] text-[var(--aurora-error)]">
          {error}
        </p>
      )}
    </form>
  );
}

export interface PropertiesInspectorProps {
  canvasBounds: CanvasDimensions;
}

const GRID_SIZES: Array<8 | 12 | 16 | 24> = [8, 12, 16, 24];

const APPEARANCE_OPTIONS: Array<{ mode: AppearanceMode; label: string; icon: string }> = [
  { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
  { mode: 'light', label: 'Light', icon: 'light_mode' },
  { mode: 'system', label: 'System', icon: 'contrast' },
];

export function PropertiesInspector({ canvasBounds }: PropertiesInspectorProps) {
  const showInspectorPanel = useEditorSessionStore((s) => s.showInspectorPanel);
  const draftLayout = useEditorSessionStore((s) => s.draftLayout);
  const draftTheme = useEditorSessionStore((s) => s.draftTheme);
  const selectedElementIds = useEditorSessionStore((s) => s.selectedElementIds);

  const commitTransformPatches = useEditorSessionStore((s) => s.commitTransformPatches);
  const setElementLocked = useEditorSessionStore((s) => s.setElementLocked);
  const setElementVisibility = useEditorSessionStore((s) => s.setElementVisibility);
  const toggleElementAspectLock = useEditorSessionStore((s) => s.toggleElementAspectLock);
  const groupSelection = useEditorSessionStore((s) => s.groupSelection);
  const ungroupSelection = useEditorSessionStore((s) => s.ungroupSelection);
  const alignSelection = useEditorSessionStore((s) => s.alignSelection);
  const distributeSelection = useEditorSessionStore((s) => s.distributeSelection);
  const duplicateSelection = useEditorSessionStore((s) => s.duplicateSelection);
  const deleteSelection = useEditorSessionStore((s) => s.deleteSelection);
  const bringAllIntoView = useEditorSessionStore((s) => s.bringAllIntoView);
  const updateGridConfig = useEditorSessionStore((s) => s.updateGridConfig);
  const updateDraftTheme = useEditorSessionStore((s) => s.updateDraftTheme);
  const setShowInspectorPanel = useEditorSessionStore((s) => s.setShowInspectorPanel);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);

  if (!showInspectorPanel || !draftLayout) return null;

  const activeAppearance: AppearanceMode = draftTheme?.appearance ?? 'dark';

  const selectedElements = selectedElementIds
    .map((id) => draftLayout.elements[id])
    .filter((el): el is NonNullable<typeof el> => Boolean(el));

  const singleElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const isMulti = selectedElements.length > 1;

  const multiBoundsRect = isMulti
    ? getRectUnion(
        selectedElements
          .map((el) =>
            transformToScreenRect(el.transform, canvasBounds, draftLayout.referenceViewport),
          )
          .filter((r): r is ScreenRect => Boolean(r)),
      )
    : null;

  const unlockedCount = getUnlockedIds(draftLayout, selectedElementIds).length;
  const canGroup = canGroupSelection(draftLayout, selectedElementIds);
  const canUngroup = canUngroupSelection(draftLayout, selectedElementIds);

  return (
    <aside
      aria-label="Properties inspector"
      className="aurora-glass-elevated fixed top-16 right-3 bottom-4 z-40 flex w-64 flex-col rounded-2xl border border-[var(--aurora-border)] shadow-[var(--glass-shadow)] sm:w-72"
    >
      <div className="flex items-center justify-between border-b border-[var(--aurora-border)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <MaterialSymbol name="tune" size={18} className="text-[var(--aurora-primary)]" />
          <h2 className="font-[var(--font-display)] text-xs font-semibold tracking-wider text-[var(--aurora-text)] uppercase">
            Inspector
          </h2>
        </div>
        <IconButton
          icon="close"
          label="Close properties inspector"
          size="sm"
          iconSize={16}
          onClick={() => setShowInspectorPanel(false)}
          className="h-6 w-6 rounded-full"
        />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
        {!singleElement && !isMulti && (
          <>
            <section className="space-y-2.5">
              <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                Canvas Grid & Snapping
              </h3>

              <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-2">
                <span className="text-xs text-[var(--aurora-text)]">Show grid overlay</span>
                <Switch
                  aria-label="Show grid overlay"
                  checked={draftLayout.grid.enabled}
                  onCheckedChange={(checked) => updateGridConfig({ enabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-2">
                <span className="text-xs text-[var(--aurora-text)]">Snap to grid</span>
                <Switch
                  aria-label="Snap to grid"
                  checked={draftLayout.grid.snapToGrid}
                  onCheckedChange={(checked) => updateGridConfig({ snapToGrid: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-2">
                <span className="text-xs text-[var(--aurora-text)]">Alignment guides</span>
                <Switch
                  aria-label="Alignment guides"
                  checked={draftLayout.grid.snapToGuides}
                  onCheckedChange={(checked) => updateGridConfig({ snapToGuides: checked })}
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
                  Grid Spacing
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {GRID_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateGridConfig({ sizePx: size })}
                      aria-pressed={draftLayout.grid.sizePx === size}
                      className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-xs font-medium transition-colors ${
                        draftLayout.grid.sizePx === size
                          ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                          : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-2.5 border-t border-[var(--aurora-border)] pt-3">
              <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                Theme &amp; Appearance
              </h3>
              <div
                role="group"
                aria-label="Theme appearance mode"
                className="grid grid-cols-3 gap-1.5"
              >
                {APPEARANCE_OPTIONS.map((opt) => {
                  const selected = activeAppearance === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        updateDraftTheme({ appearance: opt.mode }, `Switch to ${opt.label} theme`)
                      }
                      className={`aurora-focus-ring inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                          : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]'
                      }`}
                    >
                      <MaterialSymbol name={opt.icon} size={14} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {draftTheme && (
                <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/35 px-3 py-1.5 text-[11px]">
                  <span className="text-[var(--aurora-text-secondary)]">Active Accent</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[var(--aurora-text)]">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full border border-white/25"
                      style={{ backgroundColor: draftTheme.accentColor }}
                    />
                    {draftTheme.accentColor}
                  </span>
                </div>
              )}
              <Button
                variant="glass"
                size="sm"
                className="w-full"
                onClick={() => setWallpaperOpen(true)}
              >
                <MaterialSymbol name="wallpaper" size={16} />
                <span>Edit Wallpaper &amp; Palette</span>
              </Button>
            </section>

            <section className="space-y-2 border-t border-[var(--aurora-border)] pt-3">
              <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                Canvas Overview
              </h3>
              <div className="space-y-1 text-xs text-[var(--aurora-text-secondary)]">
                <p className="flex justify-between">
                  <span>Baseline</span>
                  <span className="font-mono text-[var(--aurora-text)]">
                    {draftLayout.referenceViewport.width}×{draftLayout.referenceViewport.height}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Elements</span>
                  <span className="font-mono text-[var(--aurora-text)]">
                    {draftLayout.zOrder.length}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Groups</span>
                  <span className="font-mono text-[var(--aurora-text)]">
                    {Object.keys(draftLayout.groups).length}
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => bringAllIntoView(canvasBounds)}
              >
                <MaterialSymbol name="center_focus_strong" size={16} />
                <span>Bring All Into View</span>
              </Button>
            </section>
          </>
        )}

        {singleElement && (
          <>
            <section className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[var(--aurora-text)]">
                    {singleElement.name}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[var(--aurora-text-muted)]">
                    {singleElement.type} • {singleElement.id}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    icon={singleElement.visible ? 'visibility' : 'visibility_off'}
                    label={singleElement.visible ? 'Hide element' : 'Show element'}
                    size="sm"
                    iconSize={16}
                    onClick={() => setElementVisibility(singleElement.id, !singleElement.visible)}
                  />
                  <IconButton
                    icon={singleElement.locked ? 'lock' : 'lock_open'}
                    label={singleElement.locked ? 'Unlock element' : 'Lock element'}
                    size="sm"
                    iconSize={16}
                    variant={singleElement.locked ? 'primary' : 'ghost'}
                    onClick={() => setElementLocked(singleElement.id, !singleElement.locked)}
                  />
                </div>
              </div>

              {singleElement.locked && (
                <div
                  role="note"
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--aurora-warning)]/40 bg-[var(--aurora-warning)]/10 px-2.5 py-1.5 text-[11px] text-[var(--aurora-warning)]"
                >
                  <MaterialSymbol name="lock" size={14} />
                  <span>Locked — unlock to reposition or resize.</span>
                </div>
              )}
            </section>

            <section className="space-y-2.5 border-t border-[var(--aurora-border)] pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                  Position & Size
                </h3>
                <IconButton
                  icon={singleElement.transform.aspectLocked ? 'link' : 'link_off'}
                  label={
                    singleElement.transform.aspectLocked
                      ? 'Unlock aspect ratio'
                      : 'Lock aspect ratio'
                  }
                  size="sm"
                  iconSize={15}
                  variant={singleElement.transform.aspectLocked ? 'primary' : 'ghost'}
                  onClick={() => toggleElementAspectLock(singleElement.id)}
                  className="h-6 w-6"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <NumericInspectorField
                  key={`${singleElement.id}-x-${singleElement.transform.xPct}`}
                  id="inspector-x"
                  label="X Position"
                  value={singleElement.transform.xPct}
                  unit="%"
                  min={-25}
                  max={100}
                  step={0.5}
                  disabled={singleElement.locked}
                  onCommit={(xPct) =>
                    commitTransformPatches(
                      {
                        [singleElement.id]: {
                          ...singleElement.transform,
                          xPct,
                        },
                      },
                      'Inspector set X',
                    )
                  }
                />

                <NumericInspectorField
                  key={`${singleElement.id}-y-${singleElement.transform.yPct}`}
                  id="inspector-y"
                  label="Y Position"
                  value={singleElement.transform.yPct}
                  unit="%"
                  min={-25}
                  max={100}
                  step={0.5}
                  disabled={singleElement.locked}
                  onCommit={(yPct) =>
                    commitTransformPatches(
                      {
                        [singleElement.id]: {
                          ...singleElement.transform,
                          yPct,
                        },
                      },
                      'Inspector set Y',
                    )
                  }
                />

                <NumericInspectorField
                  key={`${singleElement.id}-w-${singleElement.transform.widthPx}`}
                  id="inspector-width"
                  label="Width"
                  value={singleElement.transform.widthPx}
                  unit="px"
                  min={singleElement.transform.minWidthPx}
                  max={3600}
                  step={4}
                  disabled={singleElement.locked}
                  onCommit={(widthPx) => {
                    const ratio =
                      singleElement.transform.widthPx > 0
                        ? singleElement.transform.heightPx / singleElement.transform.widthPx
                        : 1;
                    const nextHeight = singleElement.transform.aspectLocked
                      ? Math.max(
                          singleElement.transform.minHeightPx,
                          roundPrecision(widthPx * ratio, 1),
                        )
                      : singleElement.transform.heightPx;
                    commitTransformPatches(
                      {
                        [singleElement.id]: {
                          ...singleElement.transform,
                          widthPx,
                          heightPx: nextHeight,
                        },
                      },
                      'Inspector set Width',
                    );
                  }}
                />

                <NumericInspectorField
                  key={`${singleElement.id}-h-${singleElement.transform.heightPx}`}
                  id="inspector-height"
                  label="Height"
                  value={singleElement.transform.heightPx}
                  unit="px"
                  min={singleElement.transform.minHeightPx}
                  max={2400}
                  step={4}
                  disabled={singleElement.locked}
                  onCommit={(heightPx) => {
                    const ratio =
                      singleElement.transform.heightPx > 0
                        ? singleElement.transform.widthPx / singleElement.transform.heightPx
                        : 1;
                    const nextWidth = singleElement.transform.aspectLocked
                      ? Math.max(
                          singleElement.transform.minWidthPx,
                          roundPrecision(heightPx * ratio, 1),
                        )
                      : singleElement.transform.widthPx;
                    commitTransformPatches(
                      {
                        [singleElement.id]: {
                          ...singleElement.transform,
                          heightPx,
                          widthPx: nextWidth,
                        },
                      },
                      'Inspector set Height',
                    );
                  }}
                />
              </div>
            </section>

            <section className="space-y-2 border-t border-[var(--aurora-border)] pt-3">
              <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                Align to Canvas
              </h3>
              <div className="grid grid-cols-6 gap-1">
                <IconButton
                  icon="align_horizontal_left"
                  label="Align left"
                  size="sm"
                  disabled={singleElement.locked}
                  onClick={() => alignSelection('left', canvasBounds)}
                />
                <IconButton
                  icon="align_horizontal_center"
                  label="Center horizontally"
                  size="sm"
                  disabled={singleElement.locked}
                  onClick={() => alignSelection('center', canvasBounds)}
                />
                <IconButton
                  icon="align_horizontal_right"
                  label="Align right"
                  size="sm"
                  disabled={singleElement.locked}
                  onClick={() => alignSelection('right', canvasBounds)}
                />
                <IconButton
                  icon="align_vertical_top"
                  label="Align top"
                  size="sm"
                  disabled={singleElement.locked}
                  onClick={() => alignSelection('top', canvasBounds)}
                />
                <IconButton
                  icon="align_vertical_center"
                  label="Center vertically"
                  size="sm"
                  disabled={singleElement.locked}
                  onClick={() => alignSelection('middle', canvasBounds)}
                />
                <IconButton
                  icon="align_vertical_bottom"
                  label="Align bottom"
                  size="sm"
                  disabled={singleElement.locked}
                  onClick={() => alignSelection('bottom', canvasBounds)}
                />
              </div>
            </section>

            {singleElement.type === 'clock' && (
              <ClockInspectorSection key={singleElement.id} element={singleElement} />
            )}
            {singleElement.type === 'search' && (
              <SearchInspectorSection key={singleElement.id} element={singleElement} />
            )}
            {singleElement.type === 'shortcuts' && (
              <ShortcutsInspectorSection key={singleElement.id} element={singleElement} />
            )}
            {singleElement.type === 'speed' && (
              <SpeedInspectorSection key={singleElement.id} element={singleElement} />
            )}
            {singleElement.type === 'image' && <ImageInspectorSection element={singleElement} />}
            {singleElement.type === 'gif' && <GifInspectorSection element={singleElement} />}
            {singleElement.type === 'text' && <TextInspectorSection element={singleElement} />}
            {(singleElement.type === 'image' ||
              singleElement.type === 'gif' ||
              singleElement.type === 'text' ||
              singleElement.type === 'speed') && (
              <ElementStyleInspectorSection element={singleElement} />
            )}
          </>
        )}

        {isMulti && (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--aurora-text)]">
                  {selectedElements.length} Elements Selected
                </p>
                {multiBoundsRect && (
                  <span className="font-mono text-[10px] text-[var(--aurora-text-muted)]">
                    {Math.round(multiBoundsRect.width)}×{Math.round(multiBoundsRect.height)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" disabled={!canGroup} onClick={groupSelection}>
                  <MaterialSymbol name="group_work" size={15} />
                  <span>Group</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canUngroup}
                  onClick={ungroupSelection}
                >
                  <MaterialSymbol name="workspaces" size={15} />
                  <span>Ungroup</span>
                </Button>
              </div>
            </section>

            <section className="space-y-2 border-t border-[var(--aurora-border)] pt-3">
              <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                Align Selection
              </h3>
              <div className="grid grid-cols-6 gap-1">
                <IconButton
                  icon="align_horizontal_left"
                  label="Align left"
                  size="sm"
                  disabled={unlockedCount === 0}
                  onClick={() => alignSelection('left', canvasBounds)}
                />
                <IconButton
                  icon="align_horizontal_center"
                  label="Align horizontal center"
                  size="sm"
                  disabled={unlockedCount === 0}
                  onClick={() => alignSelection('center', canvasBounds)}
                />
                <IconButton
                  icon="align_horizontal_right"
                  label="Align right"
                  size="sm"
                  disabled={unlockedCount === 0}
                  onClick={() => alignSelection('right', canvasBounds)}
                />
                <IconButton
                  icon="align_vertical_top"
                  label="Align top"
                  size="sm"
                  disabled={unlockedCount === 0}
                  onClick={() => alignSelection('top', canvasBounds)}
                />
                <IconButton
                  icon="align_vertical_center"
                  label="Align vertical middle"
                  size="sm"
                  disabled={unlockedCount === 0}
                  onClick={() => alignSelection('middle', canvasBounds)}
                />
                <IconButton
                  icon="align_vertical_bottom"
                  label="Align bottom"
                  size="sm"
                  disabled={unlockedCount === 0}
                  onClick={() => alignSelection('bottom', canvasBounds)}
                />
              </div>

              <h3 className="pt-1 text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                Distribute
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unlockedCount < 3}
                  onClick={() => distributeSelection('horizontal', canvasBounds)}
                >
                  <MaterialSymbol name="horizontal_distribute" size={15} />
                  <span>Horizontal</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unlockedCount < 3}
                  onClick={() => distributeSelection('vertical', canvasBounds)}
                >
                  <MaterialSymbol name="vertical_distribute" size={15} />
                  <span>Vertical</span>
                </Button>
              </div>
            </section>

            <section className="space-y-2 border-t border-[var(--aurora-border)] pt-3">
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicateSelection(canvasBounds)}
                >
                  <MaterialSymbol name="content_copy" size={15} />
                  <span>Duplicate</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={unlockedCount === 0}
                  onClick={deleteSelection}
                >
                  <MaterialSymbol name="delete" size={15} />
                  <span>Delete</span>
                </Button>
              </div>
            </section>
          </>
        )}
      </div>

      <WallpaperDialog open={wallpaperOpen} onOpenChange={setWallpaperOpen} />
    </aside>
  );
}
