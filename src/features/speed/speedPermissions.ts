export const CLOUDFLARE_SPEED_ORIGIN = 'https://speed.cloudflare.com/*' as const;

export type SpeedPermissionState = 'granted' | 'denied' | 'unavailable';

export function hasChromePermissionsApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.permissions) &&
    typeof chrome.permissions.contains === 'function' &&
    typeof chrome.permissions.request === 'function'
  );
}

export async function checkSpeedTestPermission(): Promise<SpeedPermissionState> {
  if (!hasChromePermissionsApi()) {
    return 'unavailable';
  }
  try {
    const granted = await chrome.permissions.contains({
      origins: [CLOUDFLARE_SPEED_ORIGIN],
    });
    return granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function requestSpeedTestPermission(): Promise<{
  granted: boolean;
  unavailable?: boolean;
  reason?: string;
}> {
  if (!hasChromePermissionsApi()) {
    return {
      granted: false,
      unavailable: true,
      reason:
        'Optional host permission requires running Deckora as a Chrome extension (Manifest V3).',
    };
  }
  try {
    const granted = await chrome.permissions.request({
      origins: [CLOUDFLARE_SPEED_ORIGIN],
    });
    if (!granted) {
      return {
        granted: false,
        reason: 'Permission not granted. You can enable Cloudflare Speed Test anytime.',
      };
    }
    return { granted: true };
  } catch (error) {
    return {
      granted: false,
      reason: error instanceof Error ? error.message : 'Permission request failed.',
    };
  }
}
