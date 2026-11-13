import { sanitizeHttpUrl } from '@/utils/url';
import { hasChromeBookmarksApi } from './bookmarksPermissions';

export interface NormalizedBookmarkItem {
  kind: 'bookmark';
  id: string;
  parentId: string | null;
  title: string;
  url: string;
  hostname: string;
  dateAdded?: number;
  pathLabels: string[];
}

export interface NormalizedBookmarkFolder {
  kind: 'folder';
  id: string;
  parentId: string | null;
  title: string;
  children: NormalizedBookmarkNode[];
  bookmarkCount: number;
  pathLabels: string[];
}

export type NormalizedBookmarkNode = NormalizedBookmarkFolder | NormalizedBookmarkItem;

export interface IndexedBookmarkItem extends NormalizedBookmarkItem {
  searchKey: string;
}

export interface BookmarksTreeSnapshot {
  roots: NormalizedBookmarkFolder[];
  foldersById: Record<string, NormalizedBookmarkFolder>;
  flatBookmarks: IndexedBookmarkItem[];
  totalBookmarks: number;
  totalFolders: number;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeNode(
  raw: chrome.bookmarks.BookmarkTreeNode,
  pathLabels: string[],
  foldersById: Record<string, NormalizedBookmarkFolder>,
  flatBookmarks: IndexedBookmarkItem[],
  counters: { folders: number; bookmarks: number },
): NormalizedBookmarkNode | null {
  if (typeof raw.url === 'string') {
    const cleanUrl = sanitizeHttpUrl(raw.url);
    if (!cleanUrl) {
      return null;
    }
    const hostname = safeHostname(cleanUrl);
    const title = raw.title?.trim() || hostname || cleanUrl;
    const item: NormalizedBookmarkItem = {
      kind: 'bookmark',
      id: raw.id,
      parentId: raw.parentId ?? null,
      title,
      url: cleanUrl,
      hostname,
      dateAdded: raw.dateAdded,
      pathLabels,
    };
    flatBookmarks.push({
      ...item,
      searchKey: `${title.toLowerCase()} ${hostname.toLowerCase()} ${cleanUrl.toLowerCase()} ${pathLabels.join(' ').toLowerCase()}`,
    });
    counters.bookmarks += 1;
    return item;
  }

  const folderTitle = raw.title?.trim() || 'Bookmarks';
  const nextPath = raw.parentId ? [...pathLabels, folderTitle] : pathLabels;
  const children: NormalizedBookmarkNode[] = [];
  let folderBookmarkCount = 0;

  for (const child of raw.children ?? []) {
    const normalizedChild = normalizeNode(child, nextPath, foldersById, flatBookmarks, counters);
    if (!normalizedChild) continue;
    children.push(normalizedChild);
    folderBookmarkCount += normalizedChild.kind === 'bookmark' ? 1 : normalizedChild.bookmarkCount;
  }

  const folder: NormalizedBookmarkFolder = {
    kind: 'folder',
    id: raw.id,
    parentId: raw.parentId ?? null,
    title: folderTitle,
    children,
    bookmarkCount: folderBookmarkCount,
    pathLabels: nextPath,
  };
  foldersById[folder.id] = folder;
  counters.folders += 1;
  return folder;
}

export function normalizeChromeBookmarkTree(
  rawTree: chrome.bookmarks.BookmarkTreeNode[],
): BookmarksTreeSnapshot {
  const foldersById: Record<string, NormalizedBookmarkFolder> = {};
  const flatBookmarks: IndexedBookmarkItem[] = [];
  const counters = { folders: 0, bookmarks: 0 };
  const roots: NormalizedBookmarkFolder[] = [];

  for (const rootRaw of rawTree) {
    // Chrome root node ('0') typically wraps "Bookmarks bar", "Other bookmarks", "Mobile bookmarks".
    if (!rootRaw.parentId && Array.isArray(rootRaw.children) && rootRaw.children.length > 0) {
      for (const topFolder of rootRaw.children) {
        const normalized = normalizeNode(topFolder, [], foldersById, flatBookmarks, counters);
        if (normalized?.kind === 'folder') {
          roots.push(normalized);
        }
      }
    } else {
      const normalized = normalizeNode(rootRaw, [], foldersById, flatBookmarks, counters);
      if (normalized?.kind === 'folder') {
        roots.push(normalized);
      }
    }
  }

  return {
    roots,
    foldersById,
    flatBookmarks,
    totalBookmarks: counters.bookmarks,
    totalFolders: counters.folders,
  };
}

export function isChromeSystemWrapperFolder(folder: NormalizedBookmarkFolder): boolean {
  const normalizedTitle = folder.title.trim().toLowerCase();
  if (folder.parentId === '0' && (folder.id === '1' || folder.id === '2' || folder.id === '3')) {
    return true;
  }
  return (
    normalizedTitle === 'bookmarks bar' ||
    normalizedTitle === 'other bookmarks' ||
    normalizedTitle === 'mobile bookmarks'
  );
}

/**
 * Returns the organized Level-1 main folders for initial Chrome Bookmarks browsing,
 * unwrapping Chrome's synthetic system containers ("Bookmarks bar", "Other bookmarks",
 * "Mobile bookmarks") and excluding loose root-level individual bookmarks from Level 1.
 */
export function getInitialMainFolders(snapshot: BookmarksTreeSnapshot): NormalizedBookmarkFolder[] {
  const mainFolders: NormalizedBookmarkFolder[] = [];
  const seenIds = new Set<string>();

  for (const rootFolder of snapshot.roots) {
    if (isChromeSystemWrapperFolder(rootFolder)) {
      for (const child of rootFolder.children) {
        if (child.kind === 'folder' && !seenIds.has(child.id)) {
          seenIds.add(child.id);
          mainFolders.push(child);
        }
      }
    } else if (!seenIds.has(rootFolder.id)) {
      seenIds.add(rootFolder.id);
      mainFolders.push(rootFolder);
    }
  }

  return mainFolders;
}

export async function fetchChromeBookmarksTree(): Promise<BookmarksTreeSnapshot> {
  if (!hasChromeBookmarksApi()) {
    throw new Error('Chrome Bookmarks API is unavailable in this context.');
  }

  const rawTree = await chrome.bookmarks.getTree();
  return normalizeChromeBookmarkTree(rawTree);
}

export function searchBookmarksSnapshot(
  snapshot: BookmarksTreeSnapshot,
  rawQuery: string,
  limit = 100,
): { matches: IndexedBookmarkItem[]; totalMatches: number } {
  const terms = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return { matches: [], totalMatches: 0 };
  }

  const matches: IndexedBookmarkItem[] = [];
  let totalMatches = 0;

  for (const item of snapshot.flatBookmarks) {
    const matched = terms.every((term) => item.searchKey.includes(term));
    if (matched) {
      totalMatches += 1;
      if (matches.length < limit) {
        matches.push(item);
      }
    }
  }

  return { matches, totalMatches };
}

/**
 * Attaches read-only change listeners to Chrome Bookmarks events and returns
 * a single idempotent cleanup function preventing duplicate subscriptions.
 */
export function subscribeToChromeBookmarkEvents(onBookmarkChange: () => void): () => void {
  if (!hasChromeBookmarksApi()) {
    return () => {};
  }

  const api = chrome.bookmarks;
  const handler = () => {
    onBookmarkChange();
  };

  api.onCreated?.addListener(handler);
  api.onRemoved?.addListener(handler);
  api.onChanged?.addListener(handler);
  api.onMoved?.addListener(handler);
  api.onChildrenReordered?.addListener(handler);
  api.onImportEnded?.addListener(handler);

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    api.onCreated?.removeListener(handler);
    api.onRemoved?.removeListener(handler);
    api.onChanged?.removeListener(handler);
    api.onMoved?.removeListener(handler);
    api.onChildrenReordered?.removeListener(handler);
    api.onImportEnded?.removeListener(handler);
  };
}
