import { useEffect } from 'react';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { ToastViewport, TooltipProvider } from '@/components/ui';
import { MasterEditorShell } from '@/features/editor/MasterEditorShell';
import { WorkspaceViewCanvas } from '@/features/editor/WorkspaceViewCanvas';
import { TopNavigation } from '@/features/navigation/TopNavigation';
import { useCustomFontsSync } from '@/hooks/useCustomFontsSync';
import { useThemeSync } from '@/hooks/useThemeSync';
import { WORKSPACE_STORAGE_KEY } from '@/services/storage/chromeStorageService';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';

export function App() {
  useThemeSync();
  useCustomFontsSync();
  const hydrate = useWorkspaceStore((s) => s.hydrate);
  const syncFromExternalStorage = useWorkspaceStore((s) => s.syncFromExternalStorage);
  const isEditing = useEditorSessionStore((s) => s.isEditing);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return undefined;
    }

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local') return;
      const changed = changes[WORKSPACE_STORAGE_KEY];
      if (!changed?.newValue) return;
      syncFromExternalStorage(changed.newValue, useEditorSessionStore.getState().isEditing);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [syncFromExternalStorage]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden">
        <AuroraBackground />

        {isEditing ? (
          <MasterEditorShell />
        ) : (
          <>
            <TopNavigation />

            <WorkspaceViewCanvas />
          </>
        )}

        <ToastViewport />
      </div>
    </TooltipProvider>
  );
}
