import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToastStore,
} from '@/components/ui';
import { DECKORA_SEED_PALETTE } from '@/design-system/tokens';
import {
  computeWallpaperSignature,
  extractPaletteFromWallpaper,
} from '@/features/theme/adaptivePalette';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';
import { ingestMediaFileToDb } from '@/services/assets/assetLifecycle';
import { MediaValidationError, validateMediaFile } from '@/services/assets/mediaValidation';
import {
  createDefaultWallpaperConfig,
  WALLPAPER_GRADIENT_PRESETS,
} from '@/services/storage/defaults';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useThemeStore } from '@/state/themeStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type { ExtractedWallpaperPalette, ThemeConfig, WallpaperConfig } from '@/types/workspace';

export interface WallpaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SOLID_SWATCHES = [
  { label: 'Midnight Navy', color: '#101827' },
  { label: 'Royal Slate', color: '#19283C' },
  { label: 'Obsidian', color: '#090D16' },
  { label: 'Deep Indigo', color: '#1E1B4B' },
  { label: 'Forest Slate', color: '#0F292E' },
  { label: 'Pearl Mist', color: '#E8F0FA' },
];

const POSITION_OPTIONS: Array<{ value: WallpaperConfig['position']; label: string }> = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'custom', label: 'Custom Focal' },
];

const FIT_OPTIONS: Array<{ value: WallpaperConfig['fit']; label: string }> = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'fill', label: 'Stretch' },
];

interface StagedImageUpload {
  file: File;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
}

function WallpaperDialogBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const isEditing = useEditorSessionStore((s) => s.isEditing);
  const draftTheme = useEditorSessionStore((s) => s.draftTheme);
  const updateDraftWallpaper = useEditorSessionStore((s) => s.updateDraftWallpaper);
  const updateDraftTheme = useEditorSessionStore((s) => s.updateDraftTheme);
  const savedTheme = useThemeStore((s) => s.theme);
  const syncThemeStore = useThemeStore((s) => s.syncFromThemeConfig);
  const saveActiveProfileWallpaper = useWorkspaceStore((s) => s.saveActiveProfileWallpaper);
  const pushToast = useToastStore((s) => s.push);

  const activeTheme = isEditing && draftTheme ? draftTheme : savedTheme;
  const initialThemeRef = useRef<ThemeConfig>(structuredClone(activeTheme));
  const initialWallpaperRef = useRef<WallpaperConfig>(structuredClone(activeTheme.wallpaper));
  const [localWallpaper, setLocalWallpaper] = useState<WallpaperConfig>(() =>
    structuredClone(activeTheme.wallpaper),
  );
  const [useAdaptive, setUseAdaptive] = useState<boolean>(activeTheme.useWallpaperAdaptivePalette);
  const [extractedPalette, setExtractedPalette] = useState<ExtractedWallpaperPalette | null>(
    activeTheme.extractedPalette ? structuredClone(activeTheme.extractedPalette) : null,
  );
  const [accentColor, setAccentColor] = useState<string>(activeTheme.accentColor);
  const [secondaryAccentColor, setSecondaryAccentColor] = useState<string>(
    activeTheme.secondaryAccentColor,
  );
  const [isPreviewingPalette, setIsPreviewingPalette] = useState(false);
  const [isExtractingPalette, setIsExtractingPalette] = useState(false);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [stagedUpload, setStagedUpload] = useState<StagedImageUpload | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const committedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputId = useId();
  const stagedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    stagedUrlRef.current = stagedUpload?.previewUrl ?? null;
  }, [stagedUpload]);

  useEffect(() => {
    const initialThemeSnapshot = initialThemeRef.current;
    return () => {
      if (stagedUrlRef.current && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(stagedUrlRef.current);
      }
      if (!committedRef.current && !isEditing) {
        syncThemeStore(initialThemeSnapshot);
      }
    };
  }, [isEditing, syncThemeStore]);

  const { url: existingAssetUrl } = useAssetObjectUrl(
    !stagedUpload && localWallpaper.type === 'image' ? localWallpaper.assetId : null,
  );

  const effectivePreviewUrl = stagedUpload?.previewUrl ?? existingAssetUrl;
  const defaultTab =
    localWallpaper.type === 'image'
      ? 'image'
      : localWallpaper.type === 'solid' || localWallpaper.type === 'none'
        ? 'solid'
        : 'gradient';

  const patchWallpaper = (patch: Partial<WallpaperConfig>) => {
    setLocalWallpaper((prev) => {
      const next = { ...prev, ...patch };
      if (isEditing && !stagedUpload) {
        updateDraftWallpaper(patch, { coalesceKey: 'wallpaper-controls' });
      }
      return next;
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError(null);
    try {
      const validated = await validateMediaFile(file, 'wallpaper', file.name);
      const previewUrl =
        typeof URL.createObjectURL === 'function' ? URL.createObjectURL(validated.blob) : '';
      if (stagedUpload?.previewUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(stagedUpload.previewUrl);
      }
      setStagedUpload({
        file,
        previewUrl,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        byteSize: validated.byteSize,
        width: validated.width,
        height: validated.height,
      });
      setLocalWallpaper((prev) => ({
        ...prev,
        type: 'image',
        dimPct: prev.dimPct === 0 ? 18 : prev.dimPct,
      }));
    } catch (error) {
      const message =
        error instanceof MediaValidationError || error instanceof Error
          ? error.message
          : 'Unable to validate wallpaper file.';
      setUploadError(message);
    }
  };

  const handleApplyContrastSafe = () => {
    patchWallpaper({
      dimPct: 30,
      overlayColor: '#101827',
      overlayOpacity: 0.24,
      vignettePct: 24,
      blurPx: Math.max(2, localWallpaper.blurPx),
    });
  };

  const handleRestoreDefault = () => {
    if (stagedUpload?.previewUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(stagedUpload.previewUrl);
    }
    setStagedUpload(null);
    setUploadError(null);
    setPaletteError(null);
    const defaults = createDefaultWallpaperConfig();
    setLocalWallpaper(defaults);
    setAccentColor(DECKORA_SEED_PALETTE.iceBlue);
    setSecondaryAccentColor(DECKORA_SEED_PALETTE.royalViolet);
    setExtractedPalette(null);
    setUseAdaptive(false);
    setIsPreviewingPalette(false);
    if (isEditing) {
      updateDraftTheme(
        {
          wallpaper: defaults,
          accentColor: DECKORA_SEED_PALETTE.iceBlue,
          secondaryAccentColor: DECKORA_SEED_PALETTE.royalViolet,
          useWallpaperAdaptivePalette: false,
          extractedPalette: null,
        },
        'Restore default wallpaper & colors',
      );
    } else {
      syncThemeStore({
        ...initialThemeRef.current,
        wallpaper: defaults,
        accentColor: DECKORA_SEED_PALETTE.iceBlue,
        secondaryAccentColor: DECKORA_SEED_PALETTE.royalViolet,
        useWallpaperAdaptivePalette: false,
        extractedPalette: null,
      });
    }
  };

  const applyLiveThemePreview = (
    nextPalette: ExtractedWallpaperPalette | null,
    nextAccent: string,
    nextSecondary: string,
    nextAdaptive: boolean,
  ) => {
    const previewTheme: ThemeConfig = {
      ...activeTheme,
      accentColor: nextAccent,
      secondaryAccentColor: nextSecondary,
      useWallpaperAdaptivePalette: nextAdaptive,
      extractedPalette: nextPalette,
      wallpaper: localWallpaper,
    };
    if (isEditing) {
      updateDraftTheme(
        {
          accentColor: nextAccent,
          secondaryAccentColor: nextSecondary,
          useWallpaperAdaptivePalette: nextAdaptive,
          extractedPalette: nextPalette,
        },
        'Preview adaptive palette',
      );
    } else {
      syncThemeStore(previewTheme);
    }
  };

  const handleExtractPalette = async (forceRegenerate = false) => {
    setIsExtractingPalette(true);
    setPaletteError(null);
    try {
      const signature = stagedUpload
        ? `staged:${stagedUpload.fileName}:${stagedUpload.byteSize}`
        : computeWallpaperSignature(localWallpaper);

      const nextPalette =
        !forceRegenerate && extractedPalette && extractedPalette.sourceSignature === signature
          ? extractedPalette
          : await extractPaletteFromWallpaper(localWallpaper, {
              imageBlob: stagedUpload?.file ?? null,
            });

      setExtractedPalette(nextPalette);
      setAccentColor(nextPalette.accent);
      if (nextPalette.secondaryAccent) {
        setSecondaryAccentColor(nextPalette.secondaryAccent);
      }
      setUseAdaptive(true);
      setIsPreviewingPalette(true);
      applyLiveThemePreview(
        nextPalette,
        nextPalette.accent,
        nextPalette.secondaryAccent ?? secondaryAccentColor,
        true,
      );
    } catch (error) {
      setPaletteError(
        error instanceof Error ? error.message : 'Unable to extract adaptive wallpaper colors.',
      );
    } finally {
      setIsExtractingPalette(false);
    }
  };

  const handleRevertPalette = () => {
    setPaletteError(null);
    setUseAdaptive(false);
    setIsPreviewingPalette(false);
    setAccentColor(DECKORA_SEED_PALETTE.iceBlue);
    setSecondaryAccentColor(DECKORA_SEED_PALETTE.royalViolet);
    applyLiveThemePreview(
      extractedPalette,
      DECKORA_SEED_PALETTE.iceBlue,
      DECKORA_SEED_PALETTE.royalViolet,
      false,
    );
  };

  const handleCommit = async () => {
    setIsApplying(true);
    setUploadError(null);
    try {
      let nextWallpaper = structuredClone(localWallpaper);
      let newAssetMeta = null;

      if (stagedUpload) {
        const ingested = await ingestMediaFileToDb(stagedUpload.file, 'wallpaper', {
          fileName: stagedUpload.fileName,
        });
        newAssetMeta = ingested.metadata;
        nextWallpaper = {
          ...nextWallpaper,
          type: 'image',
          assetId: ingested.metadata.id,
        };
      } else if (nextWallpaper.type !== 'image') {
        nextWallpaper.assetId = null;
      }

      const finalSignature = computeWallpaperSignature(nextWallpaper);
      const finalPalette = extractedPalette
        ? { ...extractedPalette, sourceSignature: finalSignature }
        : null;

      const themePatch: Partial<Omit<ThemeConfig, 'wallpaper'>> = {
        accentColor,
        secondaryAccentColor,
        useWallpaperAdaptivePalette: useAdaptive,
        extractedPalette: finalPalette,
      };

      committedRef.current = true;

      if (isEditing) {
        updateDraftWallpaper(nextWallpaper, {
          assetMetadata: newAssetMeta ?? undefined,
          label: 'Update wallpaper',
        });
        updateDraftTheme(themePatch, 'Update adaptive theme palette');
        pushToast({
          title: 'Wallpaper applied to draft',
          description: 'Click Save in Edit Mode to persist wallpaper and theme changes.',
          variant: 'info',
        });
      } else {
        await saveActiveProfileWallpaper(nextWallpaper, newAssetMeta, undefined, themePatch);
        pushToast({
          title: 'Wallpaper updated',
          description: 'Your New Tab background and theme palette have been saved.',
          variant: 'success',
        });
      }

      if (stagedUpload?.previewUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(stagedUpload.previewUrl);
      }
      setStagedUpload(null);
      onOpenChange(false);
    } catch (error) {
      committedRef.current = false;
      const message = error instanceof Error ? error.message : 'Unable to save wallpaper settings.';
      setUploadError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const objectPosition = useMemo(() => {
    switch (localWallpaper.position) {
      case 'top':
        return '50% 0%';
      case 'bottom':
        return '50% 100%';
      case 'left':
        return '0% 50%';
      case 'right':
        return '100% 50%';
      case 'custom':
        return `${localWallpaper.focalXPct}% ${localWallpaper.focalYPct}%`;
      default:
        return '50% 50%';
    }
  }, [localWallpaper.focalXPct, localWallpaper.focalYPct, localWallpaper.position]);

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Wallpaper & Background Studio</DialogTitle>
        <DialogDescription>
          Customize your background with a local image (PNG, JPEG, WebP, AVIF), curated Crystal
          gradients, or a solid surface.{' '}
          {isEditing ? 'Changes apply live to your Edit Mode draft.' : 'Changes save immediately.'}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-5">
        {/* Live Mini Preview */}
        <div
          aria-label="Wallpaper preview"
          className="relative h-40 w-full overflow-hidden rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-bg-canvas)]"
          style={{
            backgroundColor:
              localWallpaper.type === 'solid'
                ? localWallpaper.solidColor
                : 'var(--aurora-bg-canvas)',
            backgroundImage:
              localWallpaper.type === 'gradient' ? localWallpaper.gradientCss : undefined,
          }}
        >
          {localWallpaper.type === 'image' && effectivePreviewUrl && (
            <img
              src={effectivePreviewUrl}
              alt="Wallpaper preview"
              className="h-full w-full"
              style={{
                objectFit: localWallpaper.fit,
                objectPosition,
                filter: localWallpaper.blurPx > 0 ? `blur(${localWallpaper.blurPx}px)` : undefined,
              }}
            />
          )}
          {localWallpaper.dimPct > 0 && (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(4, 9, 20, ${localWallpaper.dimPct / 100})` }}
            />
          )}
          {localWallpaper.overlayOpacity > 0 && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: localWallpaper.overlayColor,
                opacity: localWallpaper.overlayOpacity,
              }}
            />
          )}
          {localWallpaper.vignettePct > 0 && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(ellipse at center, transparent 42%, rgba(4, 9, 20, ${localWallpaper.vignettePct / 100}) 100%)`,
              }}
            />
          )}

          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
            <div className="aurora-glass rounded-2xl px-4 py-2 text-xs font-medium text-[var(--aurora-text)]">
              Glass Widget Contrast Preview
            </div>
            {stagedUpload && (
              <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] text-white">
                Pending upload: {stagedUpload.fileName} (
                {Math.max(1, Math.round(stagedUpload.byteSize / 1024))} KB
                {stagedUpload.width && stagedUpload.height
                  ? ` • ${stagedUpload.width}×${stagedUpload.height}`
                  : ''}
                )
              </span>
            )}
          </div>
        </div>

        <Tabs
          defaultValue={defaultTab}
          onValueChange={(tab) => {
            if (tab === 'gradient' && localWallpaper.type !== 'gradient') {
              patchWallpaper({
                type: 'gradient',
                gradientCss:
                  localWallpaper.gradientCss || WALLPAPER_GRADIENT_PRESETS[0]!.gradientCss,
              });
            } else if (tab === 'solid' && localWallpaper.type !== 'solid') {
              patchWallpaper({ type: 'solid' });
            }
          }}
        >
          <TabsList className="w-full justify-start">
            <TabsTrigger value="image">Image Upload</TabsTrigger>
            <TabsTrigger value="gradient">Gradients</TabsTrigger>
            <TabsTrigger value="solid">Solid & Minimal</TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-4 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id={uploadInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                aria-label="Choose wallpaper image file"
                onChange={(e) => {
                  void handleFileChange(e);
                }}
                className="sr-only"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <MaterialSymbol name="upload" size={16} />
                <span>
                  {effectivePreviewUrl ? 'Replace Wallpaper Image' : 'Upload Wallpaper Image'}
                </span>
              </Button>

              {(effectivePreviewUrl || localWallpaper.type === 'image') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (stagedUpload?.previewUrl && typeof URL.revokeObjectURL === 'function') {
                      URL.revokeObjectURL(stagedUpload.previewUrl);
                    }
                    setStagedUpload(null);
                    patchWallpaper({
                      type: 'gradient',
                      assetId: null,
                      gradientCss: WALLPAPER_GRADIENT_PRESETS[0]!.gradientCss,
                    });
                  }}
                >
                  <MaterialSymbol name="delete" size={16} />
                  <span>Remove Image</span>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">
                  Sizing Mode
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {FIT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patchWallpaper({ fit: opt.value })}
                      aria-pressed={localWallpaper.fit === opt.value}
                      className={`aurora-focus-ring cursor-pointer rounded-xl border py-1.5 text-xs font-medium transition-colors ${
                        localWallpaper.fit === opt.value
                          ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                          : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">
                  Alignment / Focal Point
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {POSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patchWallpaper({ position: opt.value })}
                      aria-pressed={localWallpaper.position === opt.value}
                      className={`aurora-focus-ring cursor-pointer rounded-xl border py-1.5 text-[11px] font-medium transition-colors ${
                        localWallpaper.position === opt.value
                          ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/18 text-[var(--aurora-text)]'
                          : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 text-[var(--aurora-text-secondary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {localWallpaper.position === 'custom' && (
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[var(--aurora-text-secondary)]">
                    <span>Focal X</span>
                    <span className="font-mono">{localWallpaper.focalXPct}%</span>
                  </div>
                  <Slider
                    aria-label="Wallpaper focal X"
                    min={0}
                    max={100}
                    step={1}
                    value={[localWallpaper.focalXPct]}
                    onValueChange={([v]) =>
                      patchWallpaper({ position: 'custom', focalXPct: v ?? 50 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[var(--aurora-text-secondary)]">
                    <span>Focal Y</span>
                    <span className="font-mono">{localWallpaper.focalYPct}%</span>
                  </div>
                  <Slider
                    aria-label="Wallpaper focal Y"
                    min={0}
                    max={100}
                    step={1}
                    value={[localWallpaper.focalYPct]}
                    onValueChange={([v]) =>
                      patchWallpaper({ position: 'custom', focalYPct: v ?? 50 })
                    }
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="gradient" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {WALLPAPER_GRADIENT_PRESETS.map((preset) => {
                const isSelected =
                  localWallpaper.type === 'gradient' &&
                  localWallpaper.gradientCss === preset.gradientCss;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      patchWallpaper({
                        type: 'gradient',
                        assetId: null,
                        gradientCss: preset.gradientCss,
                      })
                    }
                    className={`aurora-focus-ring group relative flex h-16 cursor-pointer items-end overflow-hidden rounded-xl border p-2 text-left transition-all ${
                      isSelected
                        ? 'border-[var(--aurora-primary)] ring-2 ring-[var(--aurora-primary)]/40'
                        : 'border-[var(--aurora-border)] hover:border-[var(--aurora-border-highlight)]'
                    }`}
                    style={{ backgroundImage: preset.gradientCss }}
                  >
                    <span className="rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="solid" className="space-y-3 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              {SOLID_SWATCHES.map((swatch) => {
                const selected =
                  localWallpaper.type === 'solid' &&
                  localWallpaper.solidColor.toLowerCase() === swatch.color.toLowerCase();
                return (
                  <button
                    key={swatch.color}
                    type="button"
                    aria-label={`Solid color ${swatch.label}`}
                    onClick={() =>
                      patchWallpaper({
                        type: 'solid',
                        assetId: null,
                        solidColor: swatch.color,
                      })
                    }
                    className={`aurora-focus-ring flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                      selected
                        ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/15'
                        : 'border-[var(--aurora-border)]'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/25"
                      style={{ backgroundColor: swatch.color }}
                    />
                    <span>{swatch.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => patchWallpaper({ type: 'none', assetId: null })}
                className={`aurora-focus-ring cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
                  localWallpaper.type === 'none'
                    ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/15'
                    : 'border-[var(--aurora-border)]'
                }`}
              >
                None (Canvas Base)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor="wallpaper-solid-hex"
                className="text-xs font-medium text-[var(--aurora-text-secondary)]"
              >
                Custom Color
              </label>
              <input
                id="wallpaper-solid-hex"
                type="color"
                value={
                  localWallpaper.solidColor.startsWith('#') ? localWallpaper.solidColor : '#101827'
                }
                onChange={(e) =>
                  patchWallpaper({
                    type: 'solid',
                    assetId: null,
                    solidColor: e.target.value,
                  })
                }
                className="h-8 w-12 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0.5"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Atmosphere & Readability Controls */}
        <section className="space-y-3 rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-[var(--aurora-text)] uppercase">
              Backdrop Atmosphere & Contrast
            </h3>
            <Button type="button" variant="glass" size="sm" onClick={handleApplyContrastSafe}>
              <MaterialSymbol name="contrast" size={14} />
              <span>Contrast-Safe Scrim</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[var(--aurora-text-secondary)]">
                <span>Blur</span>
                <span className="font-mono">{localWallpaper.blurPx}px</span>
              </div>
              <Slider
                aria-label="Wallpaper blur"
                min={0}
                max={40}
                step={1}
                value={[localWallpaper.blurPx]}
                onValueChange={([v]) => patchWallpaper({ blurPx: v ?? 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[var(--aurora-text-secondary)]">
                <span>Dim Scrim</span>
                <span className="font-mono">{localWallpaper.dimPct}%</span>
              </div>
              <Slider
                aria-label="Wallpaper dim"
                min={0}
                max={80}
                step={1}
                value={[localWallpaper.dimPct]}
                onValueChange={([v]) => patchWallpaper({ dimPct: v ?? 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[var(--aurora-text-secondary)]">
                <span>Vignette</span>
                <span className="font-mono">{localWallpaper.vignettePct}%</span>
              </div>
              <Slider
                aria-label="Wallpaper vignette"
                min={0}
                max={80}
                step={1}
                value={[localWallpaper.vignettePct]}
                onValueChange={([v]) => patchWallpaper({ vignettePct: v ?? 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--aurora-text-secondary)]">
                <span>Tint Overlay ({Math.round(localWallpaper.overlayOpacity * 100)}%)</span>
                <input
                  type="color"
                  aria-label="Wallpaper tint color"
                  value={
                    localWallpaper.overlayColor.startsWith('#')
                      ? localWallpaper.overlayColor
                      : '#101827'
                  }
                  onChange={(e) => patchWallpaper({ overlayColor: e.target.value })}
                  className="h-5 w-7 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0"
                />
              </div>
              <Slider
                aria-label="Wallpaper overlay opacity"
                min={0}
                max={75}
                step={1}
                value={[Math.round(localWallpaper.overlayOpacity * 100)]}
                onValueChange={([v]) => patchWallpaper({ overlayOpacity: (v ?? 0) / 100 })}
              />
            </div>
          </div>
        </section>

        {/* Local Adaptive Wallpaper Palette */}
        <section
          aria-label="Adaptive wallpaper color palette"
          className="space-y-3 rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-[var(--aurora-text)] uppercase">
                Adaptive Wallpaper Palette
              </h3>
              <p className="text-[11px] text-[var(--aurora-text-muted)]">
                Computed 100% locally with WCAG contrast protection.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--aurora-text-secondary)]">Adaptive</span>
              <Switch
                aria-label="Enable adaptive wallpaper palette"
                checked={useAdaptive}
                onCheckedChange={(checked) => {
                  setUseAdaptive(checked);
                  applyLiveThemePreview(
                    extractedPalette,
                    accentColor,
                    secondaryAccentColor,
                    checked,
                  );
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="glass"
              size="sm"
              disabled={isExtractingPalette}
              onClick={() => void handleExtractPalette(true)}
            >
              <MaterialSymbol name="palette" size={14} />
              <span>
                {isExtractingPalette
                  ? 'Sampling Colors...'
                  : extractedPalette
                    ? 'Regenerate Palette'
                    : 'Extract Palette'}
              </span>
            </Button>

            <Button type="button" variant="outline" size="sm" onClick={handleRevertPalette}>
              <MaterialSymbol name="undo" size={14} />
              <span>Revert Default Colors</span>
            </Button>

            {isPreviewingPalette && (
              <span className="rounded-full bg-[var(--aurora-primary)]/18 px-2.5 py-0.5 text-[10px] font-medium text-[var(--aurora-primary)]">
                Live Preview Active
              </span>
            )}
          </div>

          {extractedPalette && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/35 px-3 py-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border border-white/25"
                  style={{ backgroundColor: extractedPalette.dominant }}
                />
                <span className="text-[var(--aurora-text-secondary)]">Dominant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border border-white/25"
                  style={{ backgroundColor: extractedPalette.accent }}
                />
                <span className="text-[var(--aurora-text-secondary)]">Accent</span>
              </div>
              {extractedPalette.secondaryAccent && (
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-white/25"
                    style={{ backgroundColor: extractedPalette.secondaryAccent }}
                  />
                  <span className="text-[var(--aurora-text-secondary)]">Secondary</span>
                </div>
              )}
              <span className="ml-auto font-mono text-[10px] text-[var(--aurora-text-muted)]">
                Rec: {extractedPalette.recommendedAppearance}
                {extractedPalette.contrastRatio ? ` • ${extractedPalette.contrastRatio}:1` : ''}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/25 px-3 py-1.5">
              <label
                htmlFor="adaptive-primary-accent"
                className="text-xs text-[var(--aurora-text-secondary)]"
              >
                Primary Accent Override
              </label>
              <input
                id="adaptive-primary-accent"
                aria-label="Primary accent color"
                type="color"
                value={accentColor}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setAccentColor(next);
                  applyLiveThemePreview(extractedPalette, next, secondaryAccentColor, useAdaptive);
                }}
                className="h-6 w-9 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/25 px-3 py-1.5">
              <label
                htmlFor="adaptive-secondary-accent"
                className="text-xs text-[var(--aurora-text-secondary)]"
              >
                Secondary Accent Override
              </label>
              <input
                id="adaptive-secondary-accent"
                aria-label="Secondary accent color"
                type="color"
                value={secondaryAccentColor}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setSecondaryAccentColor(next);
                  applyLiveThemePreview(extractedPalette, accentColor, next, useAdaptive);
                }}
                className="h-6 w-9 cursor-pointer rounded border border-[var(--aurora-border)] bg-transparent p-0"
              />
            </div>
          </div>

          {paletteError && (
            <p role="alert" className="text-xs text-[var(--aurora-warning)]">
              {paletteError}
            </p>
          )}
        </section>

        {uploadError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2 text-xs text-[var(--aurora-error)]"
          >
            <MaterialSymbol name="error" size={16} />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      <DialogFooter className="mt-5 flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={handleRestoreDefault}>
          <MaterialSymbol name="restart_alt" size={16} />
          <span>Restore Default</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isEditing) {
                updateDraftTheme({
                  ...initialThemeRef.current,
                  wallpaper: initialWallpaperRef.current,
                });
              } else {
                syncThemeStore(initialThemeRef.current);
              }
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isApplying}
            onClick={() => void handleCommit()}
          >
            <MaterialSymbol name="check" size={16} />
            <span>
              {isApplying ? 'Applying...' : isEditing ? 'Apply to Draft' : 'Save Wallpaper'}
            </span>
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function WallpaperDialog({ open, onOpenChange }: WallpaperDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <WallpaperDialogBody key="open" onOpenChange={onOpenChange} />}
    </Dialog>
  );
}
