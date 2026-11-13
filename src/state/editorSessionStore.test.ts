import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { assetDb } from '@/services/assets/assetDb';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import {
  DEFAULT_CLOCK_ELEMENT_ID,
  DEFAULT_IMAGE_PROPS,
  DEFAULT_SEARCH_ELEMENT_ID,
  DEFAULT_SHORTCUTS_ELEMENT_ID,
} from '@/services/storage/defaults';
import { MAX_HISTORY_ENTRIES } from '@/features/editor/layoutOps';
import { useEditorSessionStore } from './editorSessionStore';
import { useWorkspaceStore } from './workspaceStore';

function createMemoryAdapter(failWrites = false): {
  adapter: StorageBackendAdapter;
  setFailWrites: (fail: boolean) => void;
} {
  let shouldFail = failWrites;
  const map = new Map<string, unknown>();
  return {
    setFailWrites: (fail) => {
      shouldFail = fail;
    },
    adapter: {
      get: (key) => Promise.resolve(map.get(key)),
      set: (key, value) => {
        if (shouldFail) {
          return Promise.reject(new Error('Simulated quota failure'));
        }
        map.set(key, value);
        return Promise.resolve();
      },
      remove: (key) => {
        map.delete(key);
        return Promise.resolve();
      },
    },
  };
}

describe('Transactional Editor Session & Bounded History Store', () => {
  beforeEach(() => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useEditorSessionStore.setState(useEditorSessionStore.getInitialState());
    vi.useRealTimers();
  });

  it('isolates editingDraft from savedWorkspace and discards cleanly without persisting', async () => {
    const { adapter } = createMemoryAdapter();
    const storage = new ChromeStorageService(adapter);
    await useWorkspaceStore.getState().hydrate(storage);

    const savedBeforeXPct = useWorkspaceStore.getState().getActiveProfile()!.layout.elements[
      DEFAULT_CLOCK_ELEMENT_ID
    ]!.transform.xPct;

    expect(useEditorSessionStore.getState().enterEditMode()).toBe(true);
    expect(useEditorSessionStore.getState().isEditing).toBe(true);

    // Mutate draft: move clock and delete search bar
    useEditorSessionStore.getState().selectElement(DEFAULT_CLOCK_ELEMENT_ID);
    useEditorSessionStore.getState().nudgeSelection(40, 20);
    useEditorSessionStore.getState().selectElement(DEFAULT_SEARCH_ELEMENT_ID);
    useEditorSessionStore.getState().deleteSelection();

    expect(useEditorSessionStore.getState().isDirty).toBe(true);
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SEARCH_ELEMENT_ID],
    ).toBeUndefined();

    // Committed savedWorkspace must remain 100% untouched while editing
    const savedDuringEdit = useWorkspaceStore.getState().getActiveProfile()!.layout;
    expect(savedDuringEdit.elements[DEFAULT_CLOCK_ELEMENT_ID]?.transform.xPct).toBe(
      savedBeforeXPct,
    );
    expect(savedDuringEdit.elements[DEFAULT_SEARCH_ELEMENT_ID]).toBeDefined();

    // Discard restores clean committed workspace & clears transient session
    useEditorSessionStore.getState().discardChanges();
    expect(useEditorSessionStore.getState().isEditing).toBe(false);
    expect(useEditorSessionStore.getState().draftLayout).toBeNull();
    expect(useEditorSessionStore.getState().past).toHaveLength(0);
    expect(
      useWorkspaceStore.getState().getActiveProfile()!.layout.elements[DEFAULT_SEARCH_ELEMENT_ID],
    ).toBeDefined();

    // Simulated reload from storage preserves committed state without uncommitted draft edits
    await useWorkspaceStore.getState().hydrate(storage);
    expect(
      useWorkspaceStore.getState().getActiveProfile()!.layout.elements[DEFAULT_CLOCK_ELEMENT_ID]
        ?.transform.xPct,
    ).toBe(savedBeforeXPct);
  });

  it('commits draft atomically on save and preserves draft for retry if storage fails', async () => {
    const { adapter, setFailWrites } = createMemoryAdapter();
    const storage = new ChromeStorageService(adapter);
    await useWorkspaceStore.getState().hydrate(storage);

    useEditorSessionStore.getState().enterEditMode();
    useEditorSessionStore
      .getState()
      .setSelection([DEFAULT_CLOCK_ELEMENT_ID, DEFAULT_SEARCH_ELEMENT_ID]);
    useEditorSessionStore.getState().groupSelection();
    const draftGroupId =
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_CLOCK_ELEMENT_ID]?.groupId;
    expect(draftGroupId).toBeTruthy();

    // Fail persistence -> must stay in Edit Mode and keep draft intact
    setFailWrites(true);
    const failedOk = await useEditorSessionStore.getState().commitDraft(storage);
    expect(failedOk).toBe(false);
    expect(useEditorSessionStore.getState().isEditing).toBe(true);
    expect(useEditorSessionStore.getState().saveError).toContain(
      'Failed to write workspace to Chrome storage',
    );
    expect(useEditorSessionStore.getState().draftLayout?.groups[draftGroupId!]).toBeDefined();

    // Retry persistence -> succeeds cleanly, updates savedWorkspace, exits Edit Mode
    setFailWrites(false);
    const retryOk = await useEditorSessionStore.getState().commitDraft(storage);
    expect(retryOk).toBe(true);
    expect(useEditorSessionStore.getState().isEditing).toBe(false);
    expect(useEditorSessionStore.getState().draftLayout).toBeNull();
    expect(
      useWorkspaceStore.getState().getActiveProfile()!.layout.elements[DEFAULT_CLOCK_ELEMENT_ID]
        ?.groupId,
    ).toBe(draftGroupId);
  });

  it('supports undo/redo across operations, clears redo branch on new action, and caps history at 50', async () => {
    const { adapter } = createMemoryAdapter();
    const storage = new ChromeStorageService(adapter);
    await useWorkspaceStore.getState().hydrate(storage);

    useEditorSessionStore.getState().enterEditMode();
    const initialClockTransform = structuredClone(
      useEditorSessionStore.getState().draftLayout!.elements[DEFAULT_CLOCK_ELEMENT_ID]!.transform,
    );

    // 1. Move clock
    useEditorSessionStore.getState().commitTransformPatches(
      {
        [DEFAULT_CLOCK_ELEMENT_ID]: { ...initialClockTransform, xPct: 10 },
      },
      'Move clock',
    );
    // 2. Resize clock
    useEditorSessionStore.getState().commitTransformPatches(
      {
        [DEFAULT_CLOCK_ELEMENT_ID]: { ...initialClockTransform, xPct: 10, widthPx: 500 },
      },
      'Resize clock',
    );
    // 3. Group clock + search
    useEditorSessionStore
      .getState()
      .setSelection([DEFAULT_CLOCK_ELEMENT_ID, DEFAULT_SEARCH_ELEMENT_ID]);
    useEditorSessionStore.getState().groupSelection();
    // 4. Delete shortcuts
    useEditorSessionStore.getState().selectElement(DEFAULT_SHORTCUTS_ELEMENT_ID);
    useEditorSessionStore.getState().deleteSelection();

    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SHORTCUTS_ELEMENT_ID],
    ).toBeUndefined();

    // Undo Delete -> shortcuts restored
    useEditorSessionStore.getState().undo();
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SHORTCUTS_ELEMENT_ID],
    ).toBeDefined();

    // Undo Group -> ungrouped cleanly
    useEditorSessionStore.getState().undo();
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_CLOCK_ELEMENT_ID]?.groupId,
    ).toBeNull();

    // Redo Group -> group back
    useEditorSessionStore.getState().redo();
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_CLOCK_ELEMENT_ID]?.groupId,
    ).toBeTruthy();

    // Perform a new mutation while future has entries -> redo branch must clear!
    expect(useEditorSessionStore.getState().future.length).toBe(1);
    useEditorSessionStore.getState().selectElement(DEFAULT_SHORTCUTS_ELEMENT_ID);
    useEditorSessionStore.getState().toggleLockSelection();
    expect(useEditorSessionStore.getState().future.length).toBe(0);

    // Bounded history cap at MAX_HISTORY_ENTRIES (50)
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 15; i += 1) {
      useEditorSessionStore.getState().commitTransformPatches(
        {
          [DEFAULT_CLOCK_ELEMENT_ID]: { ...initialClockTransform, xPct: 12 + (i % 20) },
        },
        `Step ${i}`,
      );
    }
    expect(useEditorSessionStore.getState().past.length).toBe(MAX_HISTORY_ENTRIES);
  });

  it('reuses shared assetId on element duplication and cleans up orphan IndexedDB assets on Discard & Save', async () => {
    const { adapter } = createMemoryAdapter();
    const storage = new ChromeStorageService(adapter);
    await useWorkspaceStore.getState().hydrate(storage);

    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).buffer], {
      type: 'image/png',
    });

    // 1) Upload inside Edit Mode then Discard -> uploaded pending asset must be cleaned from IDB
    const discardMeta = await assetDb.addAsset({
      id: 'asset-discard-me',
      kind: 'image',
      name: 'discard.png',
      mimeType: 'image/png',
      blob: pngBlob,
    });
    useEditorSessionStore.getState().enterEditMode();
    useEditorSessionStore.getState().addElement(
      {
        id: 'el-img-discard',
        type: 'image',
        name: 'Discard Image',
        zIndex: 3,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: 10,
          yPct: 10,
          widthPx: 200,
          heightPx: 200,
          minWidthPx: 64,
          minHeightPx: 64,
          aspectLocked: false,
        },
        style: {
          opacity: 1,
          borderWidthPx: 0,
          borderColor: 'transparent',
          borderStyle: 'none',
          shadow: 'none',
          cornerRadiusPx: 12,
        },
        props: { ...DEFAULT_IMAGE_PROPS, assetId: discardMeta.id },
      },
      { assetMetadata: discardMeta },
    );

    useEditorSessionStore.getState().discardChanges();
    await vi.waitFor(async () => {
      expect(await assetDb.readAsset('asset-discard-me')).toBeNull();
    });

    // 2) Add, Save, Duplicate (shares assetId), delete ONE copy & Save -> asset survives!
    const keepMeta = await assetDb.addAsset({
      id: 'asset-keep-shared',
      kind: 'image',
      name: 'keep.png',
      mimeType: 'image/png',
      blob: pngBlob,
    });
    useEditorSessionStore.getState().enterEditMode();
    useEditorSessionStore.getState().addElement(
      {
        id: 'el-img-keep',
        type: 'image',
        name: 'Keep Image',
        zIndex: 3,
        visible: true,
        locked: false,
        groupId: null,
        transform: {
          xPct: 10,
          yPct: 10,
          widthPx: 200,
          heightPx: 200,
          minWidthPx: 64,
          minHeightPx: 64,
          aspectLocked: false,
        },
        style: {
          opacity: 1,
          borderWidthPx: 0,
          borderColor: 'transparent',
          borderStyle: 'none',
          shadow: 'none',
          cornerRadiusPx: 12,
        },
        props: { ...DEFAULT_IMAGE_PROPS, assetId: keepMeta.id },
      },
      { assetMetadata: keepMeta },
    );

    useEditorSessionStore.getState().selectElement('el-img-keep');
    useEditorSessionStore.getState().duplicateSelection();
    await useEditorSessionStore.getState().commitDraft(storage);

    const savedAfterDup = useWorkspaceStore.getState().getActiveProfile()!.layout;
    const imageElements = Object.values(savedAfterDup.elements).filter((e) => e.type === 'image');
    expect(imageElements).toHaveLength(2);
    expect(imageElements[0]!.props.assetId).toBe('asset-keep-shared');
    expect(imageElements[1]!.props.assetId).toBe('asset-keep-shared');

    // Delete ONE copy and save -> shared asset MUST STILL EXIST in IndexedDB
    useEditorSessionStore.getState().enterEditMode();
    useEditorSessionStore.getState().selectElement(imageElements[1]!.id);
    useEditorSessionStore.getState().deleteSelection();
    await useEditorSessionStore.getState().commitDraft(storage);
    expect(await assetDb.readAsset('asset-keep-shared')).not.toBeNull();

    // Delete LAST remaining copy and save -> asset now cleaned up cleanly
    useEditorSessionStore.getState().enterEditMode();
    useEditorSessionStore.getState().selectElement(imageElements[0]!.id);
    useEditorSessionStore.getState().deleteSelection();
    await useEditorSessionStore.getState().commitDraft(storage);
    await vi.waitFor(async () => {
      expect(await assetDb.readAsset('asset-keep-shared')).toBeNull();
    });
  });
});
