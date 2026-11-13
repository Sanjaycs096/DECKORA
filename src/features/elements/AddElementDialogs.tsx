import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SelectDropdown,
  Slider,
} from '@/components/ui';
import { generateStableId } from '@/features/editor/layoutOps';
import { ingestFontFileToDb, ingestMediaFileToDb } from '@/services/assets/assetLifecycle';
import {
  MediaValidationError,
  validateMediaFile,
  type ValidatedMediaFile,
} from '@/services/assets/mediaValidation';
import {
  CURATED_TEXT_FONTS,
  DEFAULT_GIF_PROPS,
  DEFAULT_IMAGE_PROPS,
  DEFAULT_TEXT_PROPS,
} from '@/services/storage/defaults';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type {
  CustomFontRecord,
  GenericCanvasElement,
  ImageShapeType,
  TextElementProps,
} from '@/types/workspace';
import { IMAGE_SHAPE_OPTIONS } from './elementStyleUtils';

export type AddElementDialogKind = 'image' | 'gif' | 'text' | null;

export interface AddElementDialogProps {
  kind: AddElementDialogKind;
  onClose: () => void;
}

function stripFileExtension(name: string): string {
  const clean = name.replace(/\.[^.]+$/, '').trim();
  return clean ? clean.slice(0, 80) : 'Media Element';
}

function computeInitialElementSize(
  width?: number,
  height?: number,
  defaultWidth = 260,
  defaultHeight = 220,
): { widthPx: number; heightPx: number } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { widthPx: defaultWidth, heightPx: defaultHeight };
  }
  const ratio = width / height;
  const targetW = 260;
  const targetH = Math.round(Math.min(360, Math.max(120, targetW / ratio)));
  return { widthPx: targetW, heightPx: targetH };
}

function centerElementPosition(widthPx: number, heightPx: number, refW = 1440, refH = 900) {
  const xPct = Number((((refW - widthPx) / 2 / refW) * 100).toFixed(2));
  const yPct = Number((((refH - heightPx) / 2 / refH) * 100).toFixed(2));
  return { xPct, yPct };
}

function AddImageBody({ onClose }: { onClose: () => void }) {
  const addElement = useEditorSessionStore((s) => s.addElement);
  const draftLayout = useEditorSessionStore((s) => s.draftLayout);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validated, setValidated] = useState<ValidatedMediaFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState('My Image');
  const [shape, setShape] = useState<ImageShapeType>('rounded-rect');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    try {
      const info = await validateMediaFile(file, 'image', file.name);
      const nextUrl =
        typeof URL.createObjectURL === 'function' ? URL.createObjectURL(info.blob) : null;
      if (previewUrlRef.current && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      setSelectedFile(file);
      setValidated(info);
      setPreviewUrl(nextUrl);
      setName(stripFileExtension(file.name));
    } catch (err) {
      setError(
        err instanceof MediaValidationError || err instanceof Error
          ? err.message
          : 'Unable to read image file.',
      );
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !validated) {
      setError('Please select a PNG, JPEG, WebP, or AVIF image file first.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { metadata } = await ingestMediaFileToDb(selectedFile, 'image', {
        fileName: validated.fileName,
      });

      const isSquare = shape === 'square' || shape === 'circle';
      const sized = isSquare
        ? { widthPx: 220, heightPx: 220 }
        : computeInitialElementSize(metadata.width, metadata.height, 280, 200);
      const pos = centerElementPosition(
        sized.widthPx,
        sized.heightPx,
        draftLayout?.referenceViewport.width ?? 1440,
        draftLayout?.referenceViewport.height ?? 900,
      );

      const newElement: GenericCanvasElement = {
        id: generateStableId('el-image'),
        type: 'image',
        name: name.trim() || stripFileExtension(validated.fileName),
        zIndex: draftLayout ? draftLayout.zOrder.length : 0,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: pos.xPct,
          yPct: pos.yPct,
          widthPx: sized.widthPx,
          heightPx: sized.heightPx,
          minWidthPx: 64,
          minHeightPx: 64,
          aspectLocked: shape === 'circle' || shape === 'square',
        },
        style: {
          opacity: 1,
          borderWidthPx: 1,
          borderColor: 'rgba(229, 234, 242, 0.25)',
          borderStyle: 'solid',
          shadow: 'soft',
          cornerRadiusPx: shape === 'rounded-rect' ? 24 : 0,
        },
        props: {
          ...DEFAULT_IMAGE_PROPS,
          assetId: metadata.id,
          altText: name.trim() || validated.fileName,
          shape,
          fit,
        },
      };

      addElement(newElement, {
        assetMetadata: metadata,
        select: true,
        label: 'Add image element',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save image to IndexedDB.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="mt-3 space-y-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          aria-label="Choose image file"
          onChange={(e) => {
            void handleFilePick(e);
          }}
          className="sr-only"
        />
        <Button type="button" variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
          <MaterialSymbol name="add_photo_alternate" size={16} />
          <span>{selectedFile ? 'Change Image' : 'Select Image File'}</span>
        </Button>
        {validated && (
          <span className="text-xs text-[var(--aurora-text-secondary)]">
            {validated.fileName} • {Math.max(1, Math.round(validated.byteSize / 1024))} KB
            {validated.width && validated.height ? ` • ${validated.width}×${validated.height}` : ''}
          </span>
        )}
      </div>

      {previewUrl && (
        <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-[var(--aurora-border)] bg-black/25 p-3">
          <img
            src={previewUrl}
            alt="Image upload preview"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="add-image-name"
            className="text-xs font-medium text-[var(--aurora-text-secondary)]"
          >
            Element Name
          </label>
          <Input
            id="add-image-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Profile portrait, Artwork..."
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Fit Mode</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(['cover', 'contain'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={fit === mode}
                onClick={() => setFit(mode)}
                className={`aurora-focus-ring cursor-pointer rounded-xl border py-2 text-xs font-medium capitalize ${
                  fit === mode
                    ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                    : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Shape Mask</span>
        <div className="grid grid-cols-4 gap-1.5">
          {IMAGE_SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={shape === opt.value}
              onClick={() => setShape(opt.value)}
              className={`aurora-focus-ring cursor-pointer rounded-xl border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                shape === opt.value
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                  : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2 text-xs text-[var(--aurora-error)]"
        >
          <MaterialSymbol name="error" size={16} />
          <span>{error}</span>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting || !selectedFile}>
          <MaterialSymbol name="add" size={16} />
          <span>{submitting ? 'Adding...' : 'Add Image to Canvas'}</span>
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddGifBody({ onClose }: { onClose: () => void }) {
  const addElement = useEditorSessionStore((s) => s.addElement);
  const draftLayout = useEditorSessionStore((s) => s.draftLayout);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validated, setValidated] = useState<ValidatedMediaFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState('Animated GIF');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    try {
      const info = await validateMediaFile(file, 'gif', file.name);
      const nextUrl =
        typeof URL.createObjectURL === 'function' ? URL.createObjectURL(info.blob) : null;
      if (previewUrlRef.current && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      setSelectedFile(file);
      setValidated(info);
      setPreviewUrl(nextUrl);
      setName(stripFileExtension(file.name));
    } catch (err) {
      setError(
        err instanceof MediaValidationError || err instanceof Error
          ? err.message
          : 'Unable to read GIF file.',
      );
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !validated) {
      setError('Please select a valid animated .gif file first.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { metadata } = await ingestMediaFileToDb(selectedFile, 'gif', {
        fileName: validated.fileName,
      });

      const sized = computeInitialElementSize(metadata.width, metadata.height, 260, 200);
      const pos = centerElementPosition(
        sized.widthPx,
        sized.heightPx,
        draftLayout?.referenceViewport.width ?? 1440,
        draftLayout?.referenceViewport.height ?? 900,
      );

      const newElement: GenericCanvasElement = {
        id: generateStableId('el-gif'),
        type: 'gif',
        name: name.trim() || stripFileExtension(validated.fileName),
        zIndex: draftLayout ? draftLayout.zOrder.length : 0,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: pos.xPct,
          yPct: pos.yPct,
          widthPx: sized.widthPx,
          heightPx: sized.heightPx,
          minWidthPx: 72,
          minHeightPx: 72,
          aspectLocked: false,
        },
        style: {
          opacity: 1,
          borderWidthPx: 1,
          borderColor: 'rgba(229, 234, 242, 0.25)',
          borderStyle: 'solid',
          shadow: 'soft',
          cornerRadiusPx: 18,
        },
        props: {
          ...DEFAULT_GIF_PROPS,
          assetId: metadata.id,
          altText: name.trim() || validated.fileName,
          fit,
        },
      };

      addElement(newElement, {
        assetMetadata: metadata,
        select: true,
        label: 'Add animated GIF element',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save GIF to IndexedDB.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="mt-3 space-y-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/gif,.gif"
          aria-label="Choose GIF file"
          onChange={(e) => {
            void handleFilePick(e);
          }}
          className="sr-only"
        />
        <Button type="button" variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
          <MaterialSymbol name="gif_box" size={16} />
          <span>{selectedFile ? 'Change GIF' : 'Select Animated GIF'}</span>
        </Button>
        {validated && (
          <span className="text-xs text-[var(--aurora-text-secondary)]">
            {validated.fileName} • {Math.max(1, Math.round(validated.byteSize / 1024))} KB
            {validated.width && validated.height ? ` • ${validated.width}×${validated.height}` : ''}
          </span>
        )}
      </div>

      {previewUrl && (
        <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-[var(--aurora-border)] bg-black/25 p-3">
          <img
            src={previewUrl}
            alt="GIF upload preview"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="add-gif-name"
            className="text-xs font-medium text-[var(--aurora-text-secondary)]"
          >
            Element Name
          </label>
          <Input
            id="add-gif-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ambient loop..."
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Fit Mode</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(['cover', 'contain'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={fit === mode}
                onClick={() => setFit(mode)}
                className={`aurora-focus-ring cursor-pointer rounded-xl border py-2 text-xs font-medium capitalize ${
                  fit === mode
                    ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                    : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2 text-xs text-[var(--aurora-error)]"
        >
          <MaterialSymbol name="error" size={16} />
          <span>{error}</span>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting || !selectedFile}>
          <MaterialSymbol name="add" size={16} />
          <span>{submitting ? 'Adding...' : 'Add GIF to Canvas'}</span>
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddTextBody({ onClose }: { onClose: () => void }) {
  const addElement = useEditorSessionStore((s) => s.addElement);
  const draftLayout = useEditorSessionStore((s) => s.draftLayout);
  const pendingFonts = useEditorSessionStore((s) => s.pendingCustomFonts);
  const savedFonts = useWorkspaceStore((s) => s.workspace.globalSettings.customFonts);

  const [name, setName] = useState('Focus Heading');
  const [content, setContent] = useState(DEFAULT_TEXT_PROPS.content);
  const [fontFamily, setFontFamily] = useState(DEFAULT_TEXT_PROPS.fontFamily);
  const [uploadedFontAssetId, setUploadedFontAssetId] = useState<string | null>(null);
  const [fontSizePx, setFontSizePx] = useState(DEFAULT_TEXT_PROPS.fontSizePx);
  const [fontWeight, setFontWeight] = useState<TextElementProps['fontWeight']>(600);
  const [color, setColor] = useState(DEFAULT_TEXT_PROPS.color);
  const [alignment, setAlignment] = useState<TextElementProps['alignment']>('center');
  const [backgroundStyle, setBackgroundStyle] =
    useState<TextElementProps['backgroundStyle']>('none');
  const [stagedFontMeta, setStagedFontMeta] = useState<{
    assetMetadata: NonNullable<Parameters<typeof addElement>[1]>['assetMetadata'];
    fontRecord: CustomFontRecord;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fontInputRef = useRef<HTMLInputElement | null>(null);
  const allUploadedFonts = [...savedFonts, ...pendingFonts].filter(
    (font, idx, arr) => arr.findIndex((item) => item.assetId === font.assetId) === idx,
  );

  const handleFontUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const { metadata, fontRecord } = await ingestFontFileToDb(file, { fileName: file.name });
      setFontFamily(fontRecord.familyName);
      setUploadedFontAssetId(fontRecord.assetId);
      setStagedFontMeta({ assetMetadata: metadata, fontRecord });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load custom WOFF/WOFF2 font.');
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const widthPx = 420;
    const heightPx = 110;
    const pos = centerElementPosition(
      widthPx,
      heightPx,
      draftLayout?.referenceViewport.width ?? 1440,
      draftLayout?.referenceViewport.height ?? 900,
    );

    const newElement: GenericCanvasElement = {
      id: generateStableId('el-text'),
      type: 'text',
      name: name.trim() || 'Text Element',
      zIndex: draftLayout ? draftLayout.zOrder.length : 0,
      visible: true,
      locked: false,
      groupId: null,
      transform: {
        xPct: pos.xPct,
        yPct: pos.yPct,
        widthPx,
        heightPx,
        minWidthPx: 100,
        minHeightPx: 44,
        aspectLocked: false,
      },
      style: {
        opacity: 1,
        borderWidthPx: 0,
        borderColor: 'rgba(229, 234, 242, 0.2)',
        borderStyle: 'none',
        shadow: 'none',
        cornerRadiusPx: 16,
      },
      props: {
        ...DEFAULT_TEXT_PROPS,
        content: content || 'Custom Text',
        fontFamily,
        uploadedFontAssetId,
        fontSizePx,
        fontWeight,
        color,
        alignment,
        backgroundStyle,
      },
    };

    addElement(newElement, {
      assetMetadata: stagedFontMeta?.assetMetadata,
      fontRecord: stagedFontMeta?.fontRecord,
      select: true,
      label: 'Add text element',
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4">
      <div className="space-y-1">
        <label
          htmlFor="add-text-content"
          className="text-xs font-medium text-[var(--aurora-text-secondary)]"
        >
          Text Content
        </label>
        <textarea
          id="add-text-content"
          rows={3}
          maxLength={4000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter a quote, mantra, title, or reminder..."
          className="aurora-focus-ring w-full rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-menu-trigger-bg)] px-3 py-2 text-sm text-[var(--aurora-menu-text)] focus:border-[var(--aurora-primary)]"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="add-text-name"
            className="text-xs font-medium text-[var(--aurora-text-secondary)]"
          >
            Layer Name
          </label>
          <Input
            id="add-text-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="add-text-font"
            className="text-xs font-medium text-[var(--aurora-text-secondary)]"
          >
            Font Family
          </label>
          <SelectDropdown
            id="add-text-font"
            ariaLabel="Font Family"
            value={fontFamily}
            options={[
              ...CURATED_TEXT_FONTS.map((opt) => ({ value: opt.value, label: opt.label })),
              ...allUploadedFonts.map((font) => ({
                value: font.familyName,
                label: `Uploaded: ${font.familyName}`,
              })),
            ]}
            onValueChange={(value) => {
              setFontFamily(value);
              const matched = allUploadedFonts.find((f) => f.familyName === value);
              setUploadedFontAssetId(matched?.assetId ?? null);
            }}
            className="h-9 rounded-xl"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 px-3 py-2">
        <span className="text-xs text-[var(--aurora-text-secondary)]">
          Optional custom font (.woff2 / .woff, max 5 MB)
        </span>
        <input
          ref={fontInputRef}
          type="file"
          accept=".woff2,.woff,font/woff2,font/woff"
          aria-label="Upload custom font file"
          onChange={(e) => {
            void handleFontUpload(e);
          }}
          className="sr-only"
        />
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={() => fontInputRef.current?.click()}
        >
          <MaterialSymbol name="font_download" size={15} />
          <span>Upload Font</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--aurora-text-secondary)]">
            <span>Size</span>
            <span className="font-mono">{fontSizePx}px</span>
          </div>
          <Slider
            aria-label="Initial text size"
            min={12}
            max={96}
            step={1}
            value={[fontSizePx]}
            onValueChange={([v]) => setFontSizePx(v ?? 28)}
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Alignment</span>
          <div className="grid grid-cols-3 gap-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                aria-pressed={alignment === align}
                onClick={() => setAlignment(align)}
                className={`aurora-focus-ring cursor-pointer rounded-lg border py-1.5 text-xs capitalize ${
                  alignment === align
                    ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                    : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label
              htmlFor="add-text-color"
              className="block text-xs font-medium text-[var(--aurora-text-secondary)]"
            >
              Color
            </label>
            <input
              id="add-text-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-11 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0.5"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label
              htmlFor="add-text-weight"
              className="block text-xs font-medium text-[var(--aurora-text-secondary)]"
            >
              Weight
            </label>
            <SelectDropdown
              id="add-text-weight"
              ariaLabel="Weight"
              value={String(fontWeight)}
              options={[
                { value: '300', label: 'Light 300' },
                { value: '400', label: 'Regular 400' },
                { value: '500', label: 'Medium 500' },
                { value: '600', label: 'Semibold 600' },
                { value: '700', label: 'Bold 700' },
              ]}
              onValueChange={(val) => setFontWeight(Number(val) as TextElementProps['fontWeight'])}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">
          Card Backing:
        </span>
        {(['none', 'crystal', 'solid'] as const).map((bg) => (
          <button
            key={bg}
            type="button"
            aria-pressed={backgroundStyle === bg}
            onClick={() => setBackgroundStyle(bg)}
            className={`aurora-focus-ring cursor-pointer rounded-full border px-3 py-1 text-xs capitalize ${
              backgroundStyle === bg
                ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
            }`}
          >
            {bg}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2 text-xs text-[var(--aurora-error)]"
        >
          <MaterialSymbol name="error" size={16} />
          <span>{error}</span>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          <MaterialSymbol name="add" size={16} />
          <span>Add Text to Canvas</span>
        </Button>
      </DialogFooter>
    </form>
  );
}

const DIALOG_COPY: Record<Exclude<AddElementDialogKind, null>, { title: string; desc: string }> = {
  image: {
    title: 'Add Image Object',
    desc: 'Upload a PNG, JPEG, WebP, or AVIF image from your computer and choose a geometric frame.',
  },
  gif: {
    title: 'Add Animated GIF',
    desc: 'Upload an animated .gif file. Original frame animation is stored locally without re-encoding.',
  },
  text: {
    title: 'Add Custom Text Element',
    desc: 'Create a customizable typography block rendered safely on your canvas.',
  },
};

export function AddElementDialog({ kind, onClose }: AddElementDialogProps) {
  const copy = kind ? DIALOG_COPY[kind] : null;
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      {kind && copy && (
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.desc}</DialogDescription>
          </DialogHeader>
          {kind === 'image' && <AddImageBody key="image" onClose={onClose} />}
          {kind === 'gif' && <AddGifBody key="gif" onClose={onClose} />}
          {kind === 'text' && <AddTextBody key="text" onClose={onClose} />}
        </DialogContent>
      )}
    </Dialog>
  );
}
