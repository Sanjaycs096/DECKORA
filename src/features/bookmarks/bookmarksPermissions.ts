export type BookmarksPermissionState = 'granted' | 'denied' | 'unavailable';

export function hasBookmarksPermissionsApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.permissions) &&
    typeof chrome.permissions.contains === 'function' &&
    typeof chrome.permissions.request === 'function'
  );
}

export function hasChromeBookmarksApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.bookmarks) &&
    typeof chrome.bookmarks.getTree === 'function'
  );
}

export async function checkBookmarksPermission(): Promise<BookmarksPermissionState> {
  if (!hasBookmarksPermissionsApi()) {
    // Some mocked/test environments expose chrome.bookmarks directly without chrome.permissions
    return hasChromeBookmarksApi() ? 'granted' : 'unavailable';
  }

  try {
    const granted = await chrome.permissions.contains({
      permissions: ['bookmarks'],
    });
    if (!granted) return 'denied';
    return hasChromeBookmarksApi() ? 'granted' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function requestBookmarksPermission(): Promise<{
  granted: boolean;
  unavailable?: boolean;
  reason?: string;
}> {
  if (!hasBookmarksPermissionsApi()) {
    return {
      granted: false,
      unavailable: true,
      reason:
        'Chrome Bookmarks permission requires running Deckora as a loaded Chrome extension (Manifest V3).',
    };
  }

  try {
    const granted = await chrome.permissions.request({
      permissions: ['bookmarks'],
    });
    if (!granted) {
      return {
        granted: false,
        reason: 'Bookmarks access was declined. Curated Deckora bookmarks remain available.',
      };
    }
    return { granted: true };
  } catch (error) {
    return {
      granted: false,
      reason: error instanceof Error ? error.message : 'Unable to request bookmarks permission.',
    };
  }
}

export function subscribeBookmarksPermissionRemoval(onRevoked: () => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.permissions?.onRemoved) {
    return () => {};
  }

  const listener = (removed: chrome.permissions.Permissions) => {
    if (removed.permissions?.includes('bookmarks')) {
      onRevoked();
    }
  };

  chrome.permissions.onRemoved.addListener(listener);
  return () => {
    chrome.permissions.onRemoved.removeListener(listener);
  };
}
