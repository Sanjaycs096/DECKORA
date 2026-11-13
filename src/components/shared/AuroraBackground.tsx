import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';
import { resolveThemePalette } from '@/design-system/themeEngine';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useThemeStore } from '@/state/themeStore';
import type { WallpaperConfig } from '@/types/workspace';

function getFallbackDeckoraGradient(appearance: 'dark' | 'light'): string {
  if (appearance === 'dark') {
    return [
      'radial-gradient(ellipse 80% 60% at 18% 12%, rgba(30, 42, 68, 0.92) 0%, transparent 65%)',
      'radial-gradient(ellipse 65% 55% at 85% 22%, rgba(139, 124, 246, 0.16) 0%, transparent 62%)',
      'radial-gradient(ellipse 70% 55% at 50% 95%, rgba(127, 211, 247, 0.12) 0%, transparent 65%)',
      'linear-gradient(180deg, #0B1220 0%, #152138 55%, #0B1220 100%)',
    ].join(', ');
  }
  return [
    'radial-gradient(ellipse 80% 60% at 16% 12%, rgba(127, 211, 247, 0.24) 0%, transparent 62%)',
    'radial-gradient(ellipse 65% 55% at 84% 20%, rgba(139, 124, 246, 0.14) 0%, transparent 60%)',
    'radial-gradient(ellipse 75% 50% at 50% 96%, rgba(234, 244, 255, 0.78) 0%, transparent 65%)',
    'linear-gradient(180deg, #F4F8FD 0%, #EAF2FA 55%, #EEF4FA 100%)',
  ].join(', ');
}

function resolveWallpaperObjectPosition(wallpaper: WallpaperConfig): string {
  switch (wallpaper.position) {
    case 'top':
      return '50% 0%';
    case 'bottom':
      return '50% 100%';
    case 'left':
      return '0% 50%';
    case 'right':
      return '100% 50%';
    case 'custom':
      return `${wallpaper.focalXPct}% ${wallpaper.focalYPct}%`;
    case 'center':
    default:
      return '50% 50%';
  }
}

export function AuroraBackground() {
  const savedTheme = useThemeStore((s) => s.theme);
  const systemPrefersDark = useThemeStore((s) => s.systemPrefersDark);
  const isEditing = useEditorSessionStore((s) => s.isEditing);
  const draftTheme = useEditorSessionStore((s) => s.draftTheme);

  const activeTheme = isEditing && draftTheme ? draftTheme : savedTheme;
  const resolvedAppearance = resolveThemePalette(activeTheme, systemPrefersDark).resolvedAppearance;
  const { wallpaper } = activeTheme;

  const { url: imageUrl, status: imageStatus } = useAssetObjectUrl(
    wallpaper.type === 'image' ? wallpaper.assetId : null,
  );

  const showImageLayer = wallpaper.type === 'image' && imageStatus === 'ready' && Boolean(imageUrl);
  const blurScale = wallpaper.blurPx > 0 ? 1 + Math.min(0.14, wallpaper.blurPx * 0.004) : 1;

  const backgroundColor =
    wallpaper.type === 'solid' ? wallpaper.solidColor : 'var(--aurora-bg-canvas)';

  const backgroundImage =
    wallpaper.type === 'gradient'
      ? wallpaper.gradientCss || getFallbackDeckoraGradient(resolvedAppearance)
      : wallpaper.type === 'none' || wallpaper.type === 'solid'
        ? undefined
        : !showImageLayer
          ? getFallbackDeckoraGradient(resolvedAppearance)
          : undefined;

  return (
    <div
      aria-hidden="true"
      data-testid="aurora-wallpaper-root"
      data-wallpaper-type={wallpaper.type}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-colors duration-[var(--aurora-duration-fast)]"
      style={{
        backgroundColor,
        backgroundImage,
      }}
    >
      {showImageLayer && imageUrl && (
        <img
          src={imageUrl}
          alt=""
          data-testid="aurora-wallpaper-image"
          className="h-full w-full transition-[filter,transform] duration-200"
          style={{
            objectFit: wallpaper.fit,
            objectPosition: resolveWallpaperObjectPosition(wallpaper),
            filter: wallpaper.blurPx > 0 ? `blur(${wallpaper.blurPx}px)` : undefined,
            transform: blurScale > 1 ? `scale(${blurScale})` : undefined,
          }}
        />
      )}

      {wallpaper.type === 'gradient' && wallpaper.blurPx > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: `blur(${wallpaper.blurPx}px)`,
          }}
        />
      )}

      {wallpaper.dimPct > 0 && (
        <div
          data-testid="aurora-wallpaper-dim"
          className="absolute inset-0"
          style={{
            backgroundColor: `rgba(4, 9, 20, ${Math.min(0.85, Math.max(0, wallpaper.dimPct / 100))})`,
          }}
        />
      )}

      {wallpaper.overlayOpacity > 0 && (
        <div
          data-testid="aurora-wallpaper-overlay"
          className="absolute inset-0"
          style={{
            backgroundColor: wallpaper.overlayColor,
            opacity: wallpaper.overlayOpacity,
          }}
        />
      )}

      {wallpaper.vignettePct > 0 && (
        <div
          data-testid="aurora-wallpaper-vignette"
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(ellipse at center, transparent 42%, rgba(4, 9, 20, ${Math.min(
              0.92,
              wallpaper.vignettePct / 100,
            )}) 100%)`,
          }}
        />
      )}
    </div>
  );
}
