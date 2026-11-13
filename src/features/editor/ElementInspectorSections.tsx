import { useRef, useState, type ChangeEvent } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { Button, Input, SelectDropdown, Slider, Switch, useToastStore } from '@/components/ui';
import { CURATED_TIMEZONES, validateTimeZone } from '@/features/clock/clockFormat';
import { IMAGE_SHAPE_OPTIONS } from '@/features/elements/elementStyleUtils';
import { validateCustomSearchTemplate } from '@/features/search/searchProviders';
import { ingestFontFileToDb, ingestMediaFileToDb } from '@/services/assets/assetLifecycle';
import { CURATED_TEXT_FONTS } from '@/services/storage/defaults';
import {
  parseClockProps,
  parseGifProps,
  parseImageProps,
  parseSearchProps,
  parseShortcutsProps,
  parseSpeedProps,
  parseTextProps,
} from '@/services/storage/schemas';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type {
  ElementStyleBase,
  GenericCanvasElement,
  SpeedAutoIntervalMinutes,
} from '@/types/workspace';

const SHADOW_OPTIONS: Array<{ value: ElementStyleBase['shadow']; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'soft', label: 'Soft' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'glow', label: 'Glow' },
];

export function ElementStyleInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementStyle = useEditorSessionStore((s) => s.updateElementStyle);

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
        Appearance & Frame
      </h3>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-[var(--aurora-text-secondary)]">
          <span>Opacity</span>
          <span className="font-mono">{Math.round(element.style.opacity * 100)}%</span>
        </div>
        <Slider
          aria-label="Element opacity"
          min={10}
          max={100}
          step={1}
          disabled={element.locked}
          value={[Math.round(element.style.opacity * 100)]}
          onValueChange={([v]) =>
            updateElementStyle(
              element.id,
              { opacity: (v ?? 100) / 100 },
              { label: 'Change opacity', coalesceKey: `opacity-${element.id}` },
            )
          }
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">Shadow</span>
        <div className="grid grid-cols-4 gap-1">
          {SHADOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={element.locked}
              aria-pressed={element.style.shadow === opt.value}
              onClick={() =>
                updateElementStyle(element.id, { shadow: opt.value }, { label: 'Set shadow' })
              }
              className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-[11px] font-medium ${
                element.style.shadow === opt.value
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                  : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
            Border
          </span>
          <SelectDropdown
            ariaLabel="Border style"
            disabled={element.locked}
            value={element.style.borderStyle}
            options={[
              { value: 'none', label: 'None' },
              { value: 'solid', label: 'Solid' },
              { value: 'dashed', label: 'Dashed' },
            ]}
            onValueChange={(value) =>
              updateElementStyle(
                element.id,
                { borderStyle: value as ElementStyleBase['borderStyle'] },
                { label: 'Change border style' },
              )
            }
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[var(--aurora-text-secondary)]">
            <span>Width ({element.style.borderWidthPx}px)</span>
            <input
              type="color"
              aria-label="Border color"
              disabled={element.locked || element.style.borderStyle === 'none'}
              value={
                element.style.borderColor.startsWith('#') ? element.style.borderColor : '#E5EAF2'
              }
              onChange={(e) =>
                updateElementStyle(
                  element.id,
                  { borderColor: e.target.value },
                  { label: 'Change border color' },
                )
              }
              className="h-4 w-5 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0"
            />
          </div>
          <Slider
            aria-label="Border width"
            min={0}
            max={12}
            step={1}
            disabled={element.locked || element.style.borderStyle === 'none'}
            value={[element.style.borderWidthPx]}
            onValueChange={([v]) =>
              updateElementStyle(
                element.id,
                { borderWidthPx: v ?? 0 },
                { label: 'Change border width', coalesceKey: `bw-${element.id}` },
              )
            }
          />
        </div>
      </div>

      {(element.type === 'gif' ||
        element.type === 'text' ||
        element.type === 'speed' ||
        (element.type === 'image' && element.props.shape === 'rounded-rect')) && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-[var(--aurora-text-secondary)]">
            <span>Corner Radius</span>
            <span className="font-mono">{Math.min(64, element.style.cornerRadiusPx)}px</span>
          </div>
          <Slider
            aria-label="Corner radius"
            min={0}
            max={64}
            step={1}
            disabled={element.locked}
            value={[Math.min(64, element.style.cornerRadiusPx)]}
            onValueChange={([v]) =>
              updateElementStyle(
                element.id,
                { cornerRadiusPx: v ?? 0 },
                { label: 'Change corner radius', coalesceKey: `radius-${element.id}` },
              )
            }
          />
        </div>
      )}
    </section>
  );
}

export function ImageInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementProps = useEditorSessionStore((s) => s.updateElementProps);
  const pushToast = useToastStore((s) => s.push);
  const [replacing, setReplacing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const props = parseImageProps(element.props);

  const handleReplaceImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReplacing(true);
    try {
      const { metadata } = await ingestMediaFileToDb(file, 'image', { fileName: file.name });
      updateElementProps(
        element.id,
        { assetId: metadata.id },
        { assetMetadata: metadata, label: 'Replace image source' },
      );
      pushToast({ title: 'Image replaced', description: metadata.name, variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Image replacement rejected',
        description: err instanceof Error ? err.message : 'Invalid image file.',
        variant: 'error',
      });
    } finally {
      setReplacing(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
          Image Shape & Crop
        </h3>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          aria-label="Replace image asset"
          onChange={(e) => {
            void handleReplaceImage(e);
          }}
          className="sr-only"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={element.locked || replacing}
          onClick={() => fileRef.current?.click()}
        >
          <MaterialSymbol name="swap_horiz" size={14} />
          <span>{replacing ? 'Loading...' : 'Replace'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {IMAGE_SHAPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={element.locked}
            aria-pressed={props.shape === opt.value}
            onClick={() =>
              updateElementProps(element.id, { shape: opt.value }, { label: `Shape: ${opt.label}` })
            }
            className={`aurora-focus-ring cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-medium ${
              props.shape === opt.value
                ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {props.shape === 'star' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-[var(--aurora-text-secondary)]">
            <span>Star Points</span>
            <span className="font-mono">{props.starPoints}</span>
          </div>
          <Slider
            aria-label="Star points"
            min={4}
            max={12}
            step={1}
            disabled={element.locked}
            value={[props.starPoints]}
            onValueChange={([v]) =>
              updateElementProps(
                element.id,
                { starPoints: v ?? 5 },
                { label: 'Adjust star points', coalesceKey: `star-${element.id}` },
              )
            }
          />
        </div>
      )}

      {props.shape === 'custom-rounded' && (
        <div className="grid grid-cols-2 gap-2">
          {(['Top Left', 'Top Right', 'Bottom Right', 'Bottom Left'] as const).map((lbl, idx) => (
            <div key={lbl} className="space-y-1">
              <div className="flex justify-between text-[10px] text-[var(--aurora-text-secondary)]">
                <span>{lbl}</span>
                <span className="font-mono">{props.customCornerRadiiPx[idx]}px</span>
              </div>
              <Slider
                aria-label={`${lbl} radius`}
                min={0}
                max={96}
                step={2}
                disabled={element.locked}
                value={[props.customCornerRadiiPx[idx] ?? 0]}
                onValueChange={([v]) => {
                  const nextRadii: [number, number, number, number] = [
                    ...props.customCornerRadiiPx,
                  ];
                  nextRadii[idx] = v ?? 0;
                  updateElementProps(
                    element.id,
                    { customCornerRadiiPx: nextRadii },
                    {
                      label: 'Adjust custom corner radius',
                      coalesceKey: `cr-${idx}-${element.id}`,
                    },
                  );
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {(['cover', 'contain'] as const).map((fitMode) => (
          <button
            key={fitMode}
            type="button"
            disabled={element.locked}
            aria-pressed={props.fit === fitMode}
            onClick={() =>
              updateElementProps(element.id, { fit: fitMode }, { label: `Image fit: ${fitMode}` })
            }
            className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-xs capitalize ${
              props.fit === fitMode
                ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
            }`}
          >
            {fitMode}
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-2.5">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[var(--aurora-text-secondary)]">
            <span>Zoom</span>
            <span className="font-mono">{props.crop.zoom.toFixed(2)}×</span>
          </div>
          <Slider
            aria-label="Image crop zoom"
            min={100}
            max={300}
            step={5}
            disabled={element.locked}
            value={[Math.round(props.crop.zoom * 100)]}
            onValueChange={([v]) =>
              updateElementProps(
                element.id,
                { crop: { ...props.crop, zoom: (v ?? 100) / 100 } },
                { label: 'Adjust crop zoom', coalesceKey: `zoom-${element.id}` },
              )
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[var(--aurora-text-secondary)]">
              <span>Pan X</span>
              <span className="font-mono">{props.crop.panXPct}%</span>
            </div>
            <Slider
              aria-label="Image pan X"
              min={0}
              max={100}
              step={1}
              disabled={element.locked}
              value={[props.crop.panXPct]}
              onValueChange={([v]) =>
                updateElementProps(
                  element.id,
                  { crop: { ...props.crop, panXPct: v ?? 50 } },
                  { label: 'Adjust pan X', coalesceKey: `panx-${element.id}` },
                )
              }
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[var(--aurora-text-secondary)]">
              <span>Pan Y</span>
              <span className="font-mono">{props.crop.panYPct}%</span>
            </div>
            <Slider
              aria-label="Image pan Y"
              min={0}
              max={100}
              step={1}
              disabled={element.locked}
              value={[props.crop.panYPct]}
              onValueChange={([v]) =>
                updateElementProps(
                  element.id,
                  { crop: { ...props.crop, panYPct: v ?? 50 } },
                  { label: 'Adjust pan Y', coalesceKey: `pany-${element.id}` },
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`alt-${element.id}`}
          className="text-[11px] font-medium text-[var(--aurora-text-secondary)]"
        >
          Alt Description
        </label>
        <Input
          id={`alt-${element.id}`}
          disabled={element.locked}
          value={props.altText}
          onChange={(e) =>
            updateElementProps(
              element.id,
              { altText: e.target.value },
              { label: 'Edit alt text', coalesceKey: `alt-${element.id}` },
            )
          }
          className="h-8 text-xs"
        />
      </div>
    </section>
  );
}

export function GifInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementProps = useEditorSessionStore((s) => s.updateElementProps);
  const pushToast = useToastStore((s) => s.push);
  const [replacing, setReplacing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const props = parseGifProps(element.props);

  const handleReplaceGif = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReplacing(true);
    try {
      const { metadata } = await ingestMediaFileToDb(file, 'gif', { fileName: file.name });
      updateElementProps(
        element.id,
        { assetId: metadata.id },
        { assetMetadata: metadata, label: 'Replace GIF source' },
      );
      pushToast({ title: 'GIF replaced', description: metadata.name, variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'GIF replacement rejected',
        description: err instanceof Error ? err.message : 'Invalid GIF file.',
        variant: 'error',
      });
    } finally {
      setReplacing(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
          Animated GIF
        </h3>
        <input
          ref={fileRef}
          type="file"
          accept="image/gif,.gif"
          aria-label="Replace GIF asset"
          onChange={(e) => {
            void handleReplaceGif(e);
          }}
          className="sr-only"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={element.locked || replacing}
          onClick={() => fileRef.current?.click()}
        >
          <MaterialSymbol name="swap_horiz" size={14} />
          <span>{replacing ? 'Loading...' : 'Replace'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {(['cover', 'contain'] as const).map((fitMode) => (
          <button
            key={fitMode}
            type="button"
            disabled={element.locked}
            aria-pressed={props.fit === fitMode}
            onClick={() =>
              updateElementProps(element.id, { fit: fitMode }, { label: `GIF fit: ${fitMode}` })
            }
            className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-xs capitalize ${
              props.fit === fitMode
                ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
            }`}
          >
            {fitMode}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-2">
        <span className="text-xs text-[var(--aurora-text)]">Start Paused</span>
        <Switch
          aria-label="Start GIF paused"
          disabled={element.locked}
          checked={props.paused}
          onCheckedChange={(checked) =>
            updateElementProps(
              element.id,
              { paused: checked },
              { label: 'Toggle GIF paused state' },
            )
          }
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-2">
        <span className="text-xs text-[var(--aurora-text)]">Show Play/Pause on Hover</span>
        <Switch
          aria-label="Show GIF hover controls"
          disabled={element.locked}
          checked={props.showControlsOnHover}
          onCheckedChange={(checked) =>
            updateElementProps(
              element.id,
              { showControlsOnHover: checked },
              { label: 'Toggle GIF hover controls' },
            )
          }
        />
      </div>
    </section>
  );
}

export function TextInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementProps = useEditorSessionStore((s) => s.updateElementProps);
  const pendingFonts = useEditorSessionStore((s) => s.pendingCustomFonts);
  const savedFonts = useWorkspaceStore((s) => s.workspace.globalSettings.customFonts);
  const pushToast = useToastStore((s) => s.push);
  const fontInputRef = useRef<HTMLInputElement | null>(null);

  const props = parseTextProps(element.props);
  const allUploadedFonts = [...savedFonts, ...pendingFonts].filter(
    (font, idx, arr) => arr.findIndex((item) => item.assetId === font.assetId) === idx,
  );

  const handleUploadFont = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { metadata, fontRecord } = await ingestFontFileToDb(file, { fileName: file.name });
      updateElementProps(
        element.id,
        { fontFamily: fontRecord.familyName, uploadedFontAssetId: fontRecord.assetId },
        { assetMetadata: metadata, fontRecord, label: 'Apply custom font' },
      );
      pushToast({
        title: 'Custom font applied',
        description: `${fontRecord.familyName} loaded locally.`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Font rejected',
        description: err instanceof Error ? err.message : 'Invalid font file.',
        variant: 'error',
      });
    }
  };

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
        Text Typography
      </h3>

      <div className="space-y-1">
        <label
          htmlFor={`text-content-${element.id}`}
          className="text-[11px] font-medium text-[var(--aurora-text-secondary)]"
        >
          Edit Text
        </label>
        <textarea
          id={`text-content-${element.id}`}
          rows={3}
          disabled={element.locked}
          value={props.content}
          onChange={(e) =>
            updateElementProps(
              element.id,
              { content: e.target.value },
              { label: 'Edit text content', coalesceKey: `txt-${element.id}` },
            )
          }
          className="aurora-focus-ring w-full rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-menu-trigger-bg)] px-2.5 py-1.5 text-xs text-[var(--aurora-text)]"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`text-font-${element.id}`}
            className="text-[11px] font-medium text-[var(--aurora-text-secondary)]"
          >
            Font Family
          </label>
          <input
            ref={fontInputRef}
            type="file"
            accept=".woff2,.woff,font/woff2,font/woff"
            aria-label="Upload custom WOFF font"
            onChange={(e) => {
              void handleUploadFont(e);
            }}
            className="sr-only"
          />
          <button
            type="button"
            disabled={element.locked}
            onClick={() => fontInputRef.current?.click()}
            className="cursor-pointer text-[11px] font-medium text-[var(--aurora-primary)] hover:underline"
          >
            + Upload Font
          </button>
        </div>
        <SelectDropdown
          id={`text-font-${element.id}`}
          ariaLabel="Font family"
          disabled={element.locked}
          value={props.fontFamily}
          contentClassName="w-60"
          options={[
            ...CURATED_TEXT_FONTS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            })),
            ...allUploadedFonts.map((font) => ({
              value: font.familyName,
              label: `Uploaded: ${font.familyName}`,
            })),
          ]}
          onValueChange={(family) => {
            const matched = allUploadedFonts.find((f) => f.familyName === family);
            updateElementProps(
              element.id,
              { fontFamily: family, uploadedFontAssetId: matched?.assetId ?? null },
              { label: 'Change font family' },
            );
          }}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-[var(--aurora-text-secondary)]">
          <span>Font Size</span>
          <span className="font-mono">{props.fontSizePx}px</span>
        </div>
        <Slider
          aria-label="Font size"
          min={10}
          max={140}
          step={1}
          disabled={element.locked}
          value={[props.fontSizePx]}
          onValueChange={([v]) =>
            updateElementProps(
              element.id,
              { fontSizePx: v ?? 28 },
              { label: 'Adjust font size', coalesceKey: `fsize-${element.id}` },
            )
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SelectDropdown
          ariaLabel="Font weight"
          disabled={element.locked}
          value={String(props.fontWeight)}
          options={[
            { value: '300', label: 'Light 300' },
            { value: '400', label: 'Regular 400' },
            { value: '500', label: 'Medium 500' },
            { value: '600', label: 'Semibold 600' },
            { value: '700', label: 'Bold 700' },
          ]}
          onValueChange={(value) =>
            updateElementProps(
              element.id,
              { fontWeight: Number(value) },
              { label: 'Change font weight' },
            )
          }
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={element.locked}
            aria-label="Italic"
            aria-pressed={props.italic}
            onClick={() =>
              updateElementProps(element.id, { italic: !props.italic }, { label: 'Toggle italic' })
            }
            className={`aurora-focus-ring flex-1 cursor-pointer rounded-lg border py-1 text-xs italic ${
              props.italic
                ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
            }`}
          >
            I
          </button>
          <button
            type="button"
            disabled={element.locked}
            aria-label="Underline"
            aria-pressed={props.underline}
            onClick={() =>
              updateElementProps(
                element.id,
                { underline: !props.underline },
                { label: 'Toggle underline' },
              )
            }
            className={`aurora-focus-ring flex-1 cursor-pointer rounded-lg border py-1 text-xs underline ${
              props.underline
                ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
            }`}
          >
            U
          </button>
          <input
            type="color"
            aria-label="Text color"
            disabled={element.locked}
            value={props.color.startsWith('#') ? props.color : '#E5EAF2'}
            onChange={(e) =>
              updateElementProps(
                element.id,
                { color: e.target.value },
                { label: 'Change text color' },
              )
            }
            className="h-7 w-8 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            type="button"
            disabled={element.locked}
            aria-pressed={props.alignment === align}
            onClick={() =>
              updateElementProps(element.id, { alignment: align }, { label: `Align text ${align}` })
            }
            className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-xs capitalize ${
              props.alignment === align
                ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
            }`}
          >
            {align}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--aurora-text-secondary)]">
            <span>Tracking</span>
            <span className="font-mono">{props.letterSpacingEm.toFixed(2)}em</span>
          </div>
          <Slider
            aria-label="Letter spacing"
            min={-5}
            max={35}
            step={1}
            disabled={element.locked}
            value={[Math.round(props.letterSpacingEm * 100)]}
            onValueChange={([v]) =>
              updateElementProps(
                element.id,
                { letterSpacingEm: (v ?? 0) / 100 },
                { label: 'Adjust letter spacing', coalesceKey: `ls-${element.id}` },
              )
            }
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--aurora-text-secondary)]">
            <span>Line Height</span>
            <span className="font-mono">{props.lineHeight.toFixed(2)}</span>
          </div>
          <Slider
            aria-label="Line height"
            min={95}
            max={220}
            step={5}
            disabled={element.locked}
            value={[Math.round(props.lineHeight * 100)]}
            onValueChange={([v]) =>
              updateElementProps(
                element.id,
                { lineHeight: (v ?? 125) / 100 },
                { label: 'Adjust line height', coalesceKey: `lh-${element.id}` },
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Text Shadow</span>
          <SelectDropdown
            ariaLabel="Text shadow"
            disabled={element.locked}
            value={props.textShadow}
            options={[
              { value: 'none', label: 'None' },
              { value: 'subtle', label: 'Subtle' },
              { value: 'crisp', label: 'Crisp' },
            ]}
            onValueChange={(value) =>
              updateElementProps(element.id, { textShadow: value }, { label: 'Change text shadow' })
            }
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Backing</span>
          <SelectDropdown
            ariaLabel="Text background style"
            disabled={element.locked}
            value={props.backgroundStyle}
            options={[
              { value: 'none', label: 'Transparent' },
              { value: 'crystal', label: 'Crystal Glass' },
              { value: 'solid', label: 'Solid Card' },
            ]}
            onValueChange={(value) =>
              updateElementProps(
                element.id,
                { backgroundStyle: value },
                { label: 'Change text backing' },
              )
            }
          />
        </div>
      </div>

      {props.backgroundStyle === 'solid' && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-2">
          <input
            type="color"
            aria-label="Text background color"
            disabled={element.locked}
            value={props.backgroundColor.startsWith('#') ? props.backgroundColor : '#19283C'}
            onChange={(e) =>
              updateElementProps(
                element.id,
                { backgroundColor: e.target.value },
                { label: 'Change backing color' },
              )
            }
            className="h-6 w-8 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0"
          />
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-[10px] text-[var(--aurora-text-secondary)]">
              <span>Fill Opacity</span>
              <span className="font-mono">{Math.round(props.backgroundOpacity * 100)}%</span>
            </div>
            <Slider
              aria-label="Text backing opacity"
              min={10}
              max={100}
              step={5}
              disabled={element.locked}
              value={[Math.round(props.backgroundOpacity * 100)]}
              onValueChange={([v]) =>
                updateElementProps(
                  element.id,
                  { backgroundOpacity: (v ?? 55) / 100 },
                  { label: 'Adjust backing opacity', coalesceKey: `tbo-${element.id}` },
                )
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}

export function ClockInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementProps = useEditorSessionStore((s) => s.updateElementProps);
  const props = parseClockProps(element.props);
  const isCuratedTz = CURATED_TIMEZONES.some((tz) => tz.value === props.timeZone);
  const [customTzInput, setCustomTzInput] = useState(isCuratedTz ? '' : props.timeZone);
  const [tzError, setTzError] = useState<string | null>(null);

  const handleApplyCustomTz = () => {
    const candidate = customTzInput.trim();
    if (!candidate) {
      setTzError(null);
      updateElementProps(element.id, { timeZone: 'local' }, { label: 'Use system timezone' });
      return;
    }
    const validation = validateTimeZone(candidate);
    if (!validation.valid) {
      setTzError('Invalid IANA timezone (example: Europe/Paris or America/Toronto).');
      return;
    }
    setTzError(null);
    updateElementProps(element.id, { timeZone: candidate }, { label: 'Set clock timezone' });
  };

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
        Clock Settings
      </h3>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Time Format
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {(['12h', '24h'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              disabled={element.locked}
              aria-pressed={props.format === fmt}
              onClick={() =>
                updateElementProps(element.id, { format: fmt }, { label: 'Set clock format' })
              }
              className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-xs font-medium ${
                props.format === fmt
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                  : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
              }`}
            >
              {fmt === '12h' ? '12-Hour' : '24-Hour'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show seconds</span>
          <Switch
            aria-label="Show clock seconds"
            disabled={element.locked}
            checked={props.showSeconds}
            onCheckedChange={(checked) =>
              updateElementProps(element.id, { showSeconds: checked }, { label: 'Toggle seconds' })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show date</span>
          <Switch
            aria-label="Show clock date"
            disabled={element.locked}
            checked={props.showDate}
            onCheckedChange={(checked) =>
              updateElementProps(element.id, { showDate: checked }, { label: 'Toggle date' })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show weekday</span>
          <Switch
            aria-label="Show clock weekday"
            disabled={element.locked}
            checked={props.showWeekday}
            onCheckedChange={(checked) =>
              updateElementProps(element.id, { showWeekday: checked }, { label: 'Toggle weekday' })
            }
          />
        </div>
      </div>

      {props.showDate && props.showWeekday && (
        <div className="grid grid-cols-2 gap-1.5">
          {(['short', 'long'] as const).map((wf) => (
            <button
              key={wf}
              type="button"
              disabled={element.locked}
              aria-pressed={props.weekdayFormat === wf}
              onClick={() =>
                updateElementProps(
                  element.id,
                  { weekdayFormat: wf },
                  { label: 'Set weekday format' },
                )
              }
              className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-[11px] font-medium capitalize ${
                props.weekdayFormat === wf
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                  : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
              }`}
            >
              {wf} weekday
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Timezone
        </span>
        <SelectDropdown
          ariaLabel="Clock timezone preset"
          disabled={element.locked}
          value={isCuratedTz ? props.timeZone : '__custom__'}
          contentClassName="w-64"
          options={[
            ...CURATED_TIMEZONES.map((tz) => ({
              value: tz.value,
              label: tz.label,
            })),
            ...(!isCuratedTz ? [{ value: '__custom__', label: `Custom (${props.timeZone})` }] : []),
          ]}
          onValueChange={(val) => {
            if (val === '__custom__') return;
            setCustomTzInput('');
            setTzError(null);
            updateElementProps(element.id, { timeZone: val }, { label: 'Set clock timezone' });
          }}
        />

        <div className="flex gap-1.5">
          <Input
            aria-label="Custom IANA timezone"
            placeholder="Custom IANA (e.g. Europe/Paris)"
            value={customTzInput}
            disabled={element.locked}
            invalid={Boolean(tzError)}
            onChange={(e) => {
              setCustomTzInput(e.target.value);
              if (tzError) setTzError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApplyCustomTz();
              }
            }}
            className="h-7 flex-1 text-[11px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={element.locked}
            onClick={handleApplyCustomTz}
            className="h-7 px-2 text-[11px]"
          >
            Apply
          </Button>
        </div>
        {tzError && (
          <p role="alert" className="text-[10px] text-[var(--aurora-error)]">
            {tzError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Container</span>
          <SelectDropdown
            ariaLabel="Clock container style"
            disabled={element.locked}
            value={props.containerStyle}
            options={[
              { value: 'floating', label: 'Floating' },
              { value: 'crystal', label: 'Royal Crystal' },
            ]}
            onValueChange={(value) =>
              updateElementProps(
                element.id,
                { containerStyle: value },
                { label: 'Set clock surface' },
              )
            }
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Alignment</span>
          <div className="grid grid-cols-3 gap-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                aria-label={`Align clock ${align}`}
                aria-pressed={props.alignment === align}
                disabled={element.locked}
                onClick={() =>
                  updateElementProps(element.id, { alignment: align }, { label: 'Align clock' })
                }
                className={`aurora-focus-ring flex h-8 cursor-pointer items-center justify-center rounded-lg border ${
                  props.alignment === align
                    ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                    : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
                }`}
              >
                <MaterialSymbol name={`format_align_${align}`} size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-[var(--aurora-text-secondary)]">
          <span>Digit Size</span>
          <span className="font-mono">{props.fontSizePx}px</span>
        </div>
        <Slider
          aria-label="Clock font size"
          min={28}
          max={140}
          step={2}
          disabled={element.locked}
          value={[props.fontSizePx]}
          onValueChange={([v]) =>
            updateElementProps(
              element.id,
              { fontSizePx: v ?? 64 },
              { label: 'Resize clock digits', coalesceKey: `clk-fs-${element.id}` },
            )
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Digit Color
        </span>
        <div className="flex items-center gap-1.5">
          {props.color && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={element.locked}
              onClick={() =>
                updateElementProps(element.id, { color: '' }, { label: 'Use theme clock color' })
              }
              className="h-6 px-2 text-[10px]"
            >
              Auto
            </Button>
          )}
          <input
            type="color"
            aria-label="Clock digit color"
            disabled={element.locked}
            value={props.color && props.color.startsWith('#') ? props.color : '#E5EAF2'}
            onChange={(e) =>
              updateElementProps(
                element.id,
                { color: e.target.value },
                { label: 'Change clock color' },
              )
            }
            className="h-6 w-8 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0"
          />
        </div>
      </div>
    </section>
  );
}

export function SearchInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementProps = useEditorSessionStore((s) => s.updateElementProps);
  const props = parseSearchProps(element.props);
  const [templateInput, setTemplateInput] = useState(props.customEngineTemplate);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const handleSaveTemplate = () => {
    const valid = validateCustomSearchTemplate(templateInput);
    if (!valid) {
      setTemplateError('Must be an http/https URL containing {query} and a valid host.');
      return;
    }
    setTemplateError(null);
    updateElementProps(
      element.id,
      { engine: 'custom', customEngineTemplate: valid },
      { label: 'Update custom search template' },
    );
  };

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
        Search Bar Settings
      </h3>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Default Engine
        </span>
        <SelectDropdown
          ariaLabel="Default search engine"
          disabled={element.locked}
          value={props.engine}
          options={[
            { value: 'google', label: 'Google' },
            { value: 'bing', label: 'Bing' },
            { value: 'duckduckgo', label: 'DuckDuckGo' },
            { value: 'custom', label: 'Custom URL Template' },
          ]}
          onValueChange={(value) =>
            updateElementProps(element.id, { engine: value }, { label: 'Change search engine' })
          }
        />
      </div>

      {props.engine === 'custom' && (
        <div className="space-y-1.5 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/35 p-2.5">
          <span className="text-[10px] font-medium text-[var(--aurora-text-secondary)]">
            Custom URL ({'{query}'} placeholder)
          </span>
          <div className="flex gap-1.5">
            <Input
              aria-label="Custom search URL template"
              placeholder="https://kagi.com/search?q={query}"
              value={templateInput}
              disabled={element.locked}
              invalid={Boolean(templateError)}
              onChange={(e) => {
                setTemplateInput(e.target.value);
                if (templateError) setTemplateError(null);
              }}
              className="h-7 flex-1 text-[11px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={element.locked}
              onClick={handleSaveTemplate}
              className="h-7 px-2 text-[11px]"
            >
              Set
            </Button>
          </div>
          {templateError && (
            <p role="alert" className="text-[10px] text-[var(--aurora-error)]">
              {templateError}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Placeholder Override
        </span>
        <Input
          aria-label="Search placeholder text"
          placeholder="Leave blank for engine default"
          value={props.placeholder}
          disabled={element.locked}
          onChange={(e) =>
            updateElementProps(
              element.id,
              { placeholder: e.target.value },
              { label: 'Edit search placeholder', coalesceKey: `sp-${element.id}` },
            )
          }
          className="h-8 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Visual Style</span>
          <SelectDropdown
            ariaLabel="Search visual style"
            disabled={element.locked}
            value={props.visualStyle}
            options={[
              { value: 'glass', label: 'Royal Crystal' },
              { value: 'solid', label: 'Solid Elevated' },
            ]}
            onValueChange={(value) =>
              updateElementProps(element.id, { visualStyle: value }, { label: 'Set search style' })
            }
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Focus Shortcut</span>
          <SelectDropdown
            ariaLabel="Search focus shortcut"
            disabled={element.locked}
            value={props.focusShortcut}
            options={[
              { value: 'both', label: '/ or Ctrl+K' },
              { value: '/', label: '/ Slash Key' },
              { value: 'ctrl+k', label: 'Ctrl / Cmd + K' },
              { value: 'none', label: 'Disabled' },
            ]}
            onValueChange={(value) =>
              updateElementProps(
                element.id,
                { focusShortcut: value },
                { label: 'Set focus shortcut' },
              )
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show engine selector</span>
          <Switch
            aria-label="Show search engine selector"
            disabled={element.locked}
            checked={props.showEngineSelector}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showEngineSelector: checked },
                { label: 'Toggle engine selector' },
              )
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show search icon</span>
          <Switch
            aria-label="Show search icon"
            disabled={element.locked}
            checked={props.showSearchIcon}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showSearchIcon: checked },
                { label: 'Toggle search icon' },
              )
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show clear button</span>
          <Switch
            aria-label="Show search clear button"
            disabled={element.locked}
            checked={props.showClearButton}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showClearButton: checked },
                { label: 'Toggle clear button' },
              )
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <div className="min-w-0 pr-2">
            <p className="text-xs text-[var(--aurora-text)]">Local query history</p>
            <p className="text-[10px] text-[var(--aurora-text-muted)]">
              Saved locally on-device only
            </p>
          </div>
          <Switch
            aria-label="Enable local search history"
            disabled={element.locked}
            checked={props.enableLocalHistory}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { enableLocalHistory: checked },
                { label: 'Toggle local search history' },
              )
            }
          />
        </div>
      </div>

      {props.recentQueries.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={element.locked}
          onClick={() =>
            updateElementProps(
              element.id,
              { recentQueries: [] },
              { label: 'Clear local search history' },
            )
          }
          className="w-full"
        >
          <MaterialSymbol name="delete_sweep" size={15} />
          <span>Clear Local History ({props.recentQueries.length})</span>
        </Button>
      )}
    </section>
  );
}

export function ShortcutsInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementProps = useEditorSessionStore((s) => s.updateElementProps);
  const props = parseShortcutsProps(element.props, []);

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
          Shortcuts Grid
        </h3>
        <span className="font-mono text-[10px] text-[var(--aurora-text-muted)]">
          {props.items.length} / 48
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show tile labels</span>
          <Switch
            aria-label="Show shortcut labels"
            disabled={element.locked}
            checked={props.showLabels}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showLabels: checked },
                { label: 'Toggle shortcut labels' },
              )
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Open links in new tab</span>
          <Switch
            aria-label="Open shortcuts in new tab"
            disabled={element.locked}
            checked={props.openInNewTab}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { openInNewTab: checked },
                { label: 'Toggle open in new tab' },
              )
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Layout Direction
        </span>
        <div
          className="grid grid-cols-2 gap-1.5"
          role="group"
          aria-label="Shortcuts layout direction"
        >
          {(
            [
              { value: 'horizontal', label: 'Horizontal', icon: 'horizontal_distribute' },
              { value: 'vertical', label: 'Vertical', icon: 'vertical_distribute' },
            ] as const
          ).map((dir) => (
            <button
              key={dir.value}
              type="button"
              disabled={element.locked}
              aria-pressed={props.orientation === dir.value}
              onClick={() =>
                updateElementProps(
                  element.id,
                  { orientation: dir.value },
                  { label: `Set shortcuts ${dir.value}` },
                )
              }
              className={`aurora-focus-ring flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-medium ${
                props.orientation === dir.value
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                  : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
              }`}
            >
              <MaterialSymbol name={dir.icon} size={14} />
              <span>{dir.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Tile Shape
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(['squircle', 'circle', 'square'] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              disabled={element.locked}
              aria-pressed={props.iconShape === shape}
              onClick={() =>
                updateElementProps(element.id, { iconShape: shape }, { label: 'Set tile shape' })
              }
              className={`aurora-focus-ring cursor-pointer rounded-lg border py-1 text-[11px] font-medium capitalize ${
                props.iconShape === shape
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                  : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
              }`}
            >
              {shape}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Density</span>
          <SelectDropdown
            ariaLabel="Shortcuts grid density"
            disabled={element.locked}
            value={props.density}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
            onValueChange={(value) =>
              updateElementProps(element.id, { density: value }, { label: 'Set shortcuts density' })
            }
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Columns</span>
          <SelectDropdown
            ariaLabel="Shortcuts grid columns"
            disabled={element.locked}
            value={String(props.columns)}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: '3', label: '3 Columns' },
              { value: '4', label: '4 Columns' },
              { value: '5', label: '5 Columns' },
              { value: '6', label: '6 Columns' },
            ]}
            onValueChange={(raw) => {
              const columns = raw === 'auto' ? 'auto' : (Number(raw) as 3 | 4 | 5 | 6);
              updateElementProps(element.id, { columns }, { label: 'Set shortcuts columns' });
            }}
          />
        </div>
      </div>
    </section>
  );
}

const SPEED_INTERVAL_OPTIONS: Array<{ value: SpeedAutoIntervalMinutes; label: string }> = [
  { value: 0, label: 'Manual Only' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every 60 minutes' },
];

export function SpeedInspectorSection({ element }: { element: GenericCanvasElement }) {
  const updateElementProps = useEditorSessionStore((s) => s.updateElementProps);
  const props = parseSpeedProps(element.props);

  return (
    <section className="space-y-3 border-t border-[var(--aurora-border)] pt-3">
      <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
        Speed Monitor
      </h3>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Widget Title
        </span>
        <Input
          aria-label="Speed monitor title"
          value={props.title}
          disabled={element.locked}
          onChange={(e) =>
            updateElementProps(
              element.id,
              { title: e.target.value },
              { label: 'Rename speed monitor', coalesceKey: `spd-title-${element.id}` },
            )
          }
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
          Scheduled Measurement
        </span>
        <SelectDropdown
          ariaLabel="Auto-measure schedule"
          disabled={element.locked}
          value={String(props.autoMeasureIntervalMinutes)}
          options={SPEED_INTERVAL_OPTIONS.map((opt) => ({
            value: String(opt.value),
            label: opt.label,
          }))}
          onValueChange={(value) =>
            updateElementProps(
              element.id,
              { autoMeasureIntervalMinutes: Number(value) },
              { label: 'Change speed schedule' },
            )
          }
        />
        <p role="note" className="text-[10px] leading-relaxed text-[var(--aurora-text-muted)]">
          Bounded background checks run only while Chrome is open and optional Cloudflare speed
          permission is granted.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Layout Mode</span>
          <SelectDropdown
            ariaLabel="Speed widget layout mode"
            disabled={element.locked}
            value={props.layoutMode}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'compact', label: 'Compact' },
            ]}
            onValueChange={(value) =>
              updateElementProps(
                element.id,
                { layoutMode: value },
                { label: 'Set speed layout mode' },
              )
            }
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Precision</span>
          <SelectDropdown
            ariaLabel="Speed metric precision"
            disabled={element.locked}
            value={String(props.precision)}
            options={[
              { value: '1', label: '1 Decimal' },
              { value: '2', label: '2 Decimals' },
            ]}
            onValueChange={(value) =>
              updateElementProps(
                element.id,
                { precision: Number(value) },
                { label: 'Set speed precision' },
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Download Probe</span>
          <SelectDropdown
            ariaLabel="Download probe payload"
            disabled={element.locked}
            value={String(props.downloadProbeBytes)}
            options={[
              { value: String(1_048_576), label: '1 MB (Light)' },
              { value: String(2_097_152), label: '2 MB (Balanced)' },
              { value: String(5_242_880), label: '5 MB (Accurate)' },
            ]}
            onValueChange={(value) =>
              updateElementProps(
                element.id,
                { downloadProbeBytes: Number(value) },
                { label: 'Set download probe size' },
              )
            }
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-[var(--aurora-text-secondary)]">Upload Probe</span>
          <SelectDropdown
            ariaLabel="Upload probe payload"
            disabled={element.locked}
            value={String(props.uploadProbeBytes)}
            options={[
              { value: String(524_288), label: '512 KB (Light)' },
              { value: String(1_048_576), label: '1 MB (Standard)' },
            ]}
            onValueChange={(value) =>
              updateElementProps(
                element.id,
                { uploadProbeBytes: Number(value) },
                { label: 'Set upload probe size' },
              )
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show download</span>
          <Switch
            aria-label="Show download metric"
            disabled={element.locked}
            checked={props.showDownload}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showDownload: checked },
                { label: 'Toggle download metric' },
              )
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show upload</span>
          <Switch
            aria-label="Show upload metric"
            disabled={element.locked}
            checked={props.showUpload}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showUpload: checked },
                { label: 'Toggle upload metric' },
              )
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show ping & jitter</span>
          <Switch
            aria-label="Show ping metric"
            disabled={element.locked}
            checked={props.showPing}
            onCheckedChange={(checked) =>
              updateElementProps(element.id, { showPing: checked }, { label: 'Toggle ping metric' })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show last tested time</span>
          <Switch
            aria-label="Show last tested time"
            disabled={element.locked}
            checked={props.showLastTested}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showLastTested: checked },
                { label: 'Toggle last tested display' },
              )
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 px-3 py-1.5">
          <span className="text-xs text-[var(--aurora-text)]">Show manual test button</span>
          <Switch
            aria-label="Show manual speed test button"
            disabled={element.locked}
            checked={props.showManualButton}
            onCheckedChange={(checked) =>
              updateElementProps(
                element.id,
                { showManualButton: checked },
                { label: 'Toggle manual test button' },
              )
            }
          />
        </div>
      </div>
    </section>
  );
}
