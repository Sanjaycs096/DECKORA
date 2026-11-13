import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToastStore,
} from '@/components/ui';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import {
  DECKORA_BUNDLE_EXTENSION,
  LEGACY_AURORA_BUNDLE_EXTENSION,
  type BundleExportScope,
} from './bundleFormat';
import { exportWorkspaceBundle, type ExportProgress } from './exportService';
import {
  executeTransactionalImport,
  inspectAndValidateBundle,
  type ImportMode,
  type ValidatedImportBundle,
} from './importService';

export interface PortabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatKilobytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PortabilityDialog({ open, onOpenChange }: PortabilityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <PortabilityDialogBody onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function PortabilityDialogBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const isEditing = useEditorSessionStore((s) => s.isEditing);
  const pushToast = useToastStore((s) => s.push);

  const [exportScope, setExportScope] = useState<BundleExportScope>('single-profile');
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportAbortRef = useRef<AbortController | null>(null);

  const [inspectedBundle, setInspectedBundle] = useState<ValidatedImportBundle | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('import-as-new');
  const [importError, setImportError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  useEffect(() => {
    return () => {
      exportAbortRef.current?.abort();
      exportAbortRef.current = null;
    };
  }, []);

  const activeProfile = workspace.profiles[workspace.activeProfileId];
  const profileCount = Object.keys(workspace.profiles).length;

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    const controller = new AbortController();
    exportAbortRef.current = controller;

    try {
      const result = await exportWorkspaceBundle(workspace, {
        scope: exportScope,
        profileId: workspace.activeProfileId,
        signal: controller.signal,
        onProgress: setExportProgress,
      });

      const downloadUrl = URL.createObjectURL(result.blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = result.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } finally {
        URL.revokeObjectURL(downloadUrl);
      }

      pushToast({
        title: 'Backup exported cleanly',
        description: `${result.fileName} (${formatKilobytes(result.byteSize)}) with ${result.manifest.assetCount} asset(s).`,
        variant: 'success',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setExportError('Export cancelled.');
      } else {
        setExportError(error instanceof Error ? error.message : 'Unable to export backup archive.');
      }
    } finally {
      exportAbortRef.current = null;
      setIsExporting(false);
    }
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    setInspectedBundle(null);
    setConfirmDestructive(false);
    setIsInspecting(true);

    try {
      const validated = await inspectAndValidateBundle(file);
      setInspectedBundle(validated);
      setImportMode(validated.summary.profileCount > 1 ? 'restore-all' : 'import-as-new');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Invalid backup file.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleApplyImport = async () => {
    if (!inspectedBundle) return;
    if (isEditing) {
      setImportError('Save or discard your active Edit Mode draft before importing a backup.');
      return;
    }

    if ((importMode === 'replace-profile' || importMode === 'restore-all') && !confirmDestructive) {
      setConfirmDestructive(true);
      return;
    }

    setIsImporting(true);
    setImportError(null);
    try {
      const result = await executeTransactionalImport(inspectedBundle, {
        mode: importMode,
        targetProfileId: workspace.activeProfileId,
      });
      pushToast({
        title: 'Workspace backup imported',
        description: `Imported ${result.importedProfileIds.length} profile(s) and ${result.stagedAssetIds.length} verified asset(s).`,
        variant: 'success',
      });
      setInspectedBundle(null);
      setConfirmDestructive(false);
      onOpenChange(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to commit imported backup.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Backup &amp; Restore Studio</DialogTitle>
        <DialogDescription>
          Export self-contained <code className="text-xs">{DECKORA_BUNDLE_EXTENSION}</code> bundles
          with embedded local media or import Deckora / legacy{' '}
          <code className="text-xs">{LEGACY_AURORA_BUNDLE_EXTENSION}</code> backups.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="export" className="mt-3">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="export">Export Backup</TabsTrigger>
          <TabsTrigger value="import">Import / Restore</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setExportScope('single-profile')}
              aria-pressed={exportScope === 'single-profile'}
              className={`aurora-focus-ring cursor-pointer rounded-2xl border p-3.5 text-left transition-colors ${
                exportScope === 'single-profile'
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/14'
                  : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <MaterialSymbol name="person" size={18} className="text-[var(--aurora-primary)]" />
                <p className="text-xs font-semibold text-[var(--aurora-text)]">
                  Active Profile Only
                </p>
              </div>
              <p className="mt-1 text-[11px] text-[var(--aurora-text-secondary)]">
                Exports &ldquo;{activeProfile?.name ?? 'Personal'}&rdquo;, its theme, wallpaper,
                shortcuts, and referenced media.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setExportScope('full-workspace')}
              aria-pressed={exportScope === 'full-workspace'}
              className={`aurora-focus-ring cursor-pointer rounded-2xl border p-3.5 text-left transition-colors ${
                exportScope === 'full-workspace'
                  ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/14'
                  : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <MaterialSymbol
                  name="workspaces"
                  size={18}
                  className="text-[var(--aurora-secondary)]"
                />
                <p className="text-xs font-semibold text-[var(--aurora-text)]">
                  Full Workspace ({profileCount} profile{profileCount === 1 ? '' : 's'})
                </p>
              </div>
              <p className="mt-1 text-[11px] text-[var(--aurora-text-secondary)]">
                Exports all profiles, custom fonts, and all referenced wallpapers, images, and
                animated GIFs.
              </p>
            </button>
          </div>

          {exportProgress && (
            <div
              role="status"
              className="space-y-1.5 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 p-3"
            >
              <div className="flex justify-between text-xs text-[var(--aurora-text)]">
                <span>{exportProgress.message}</span>
                <span className="font-mono">{exportProgress.percent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/25">
                <div
                  className="h-full bg-[var(--aurora-primary)] transition-all duration-200"
                  style={{ width: `${exportProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {exportError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2 text-xs text-[var(--aurora-error)]"
            >
              <MaterialSymbol name="error" size={16} />
              <span>{exportError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-[var(--aurora-text-muted)]">
              Transient Blob URLs and network speed cache are excluded automatically.
            </p>
            <div className="flex items-center gap-2">
              {isExporting && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportAbortRef.current?.abort()}
                >
                  Cancel Export
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                disabled={isExporting}
                onClick={() => void handleExport()}
              >
                <MaterialSymbol name="download" size={16} />
                <span>{isExporting ? 'Exporting...' : 'Download .deckora-bundle.zip'}</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="import" className="space-y-4 pt-4">
          {isEditing && (
            <div
              role="note"
              className="flex items-center gap-2 rounded-xl border border-[var(--aurora-warning)]/40 bg-[var(--aurora-warning)]/12 px-3 py-2 text-xs text-[var(--aurora-warning)]"
            >
              <MaterialSymbol name="warning" size={16} />
              <span>Save or discard your active Edit Mode draft before importing a backup.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-4">
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept=".zip,.deckora-bundle.zip,.aurora-bundle.zip,application/zip"
              aria-label="Choose Deckora backup file"
              onChange={(e) => void handleImportFileChange(e)}
              className="sr-only"
            />
            <Button
              type="button"
              variant="glass"
              disabled={isInspecting || isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              <MaterialSymbol name="upload_file" size={16} />
              <span>
                {isInspecting ? 'Validating Archive...' : 'Select .deckora-bundle.zip File'}
              </span>
            </Button>
            <p className="text-xs text-[var(--aurora-text-secondary)]">
              Untrusted backups are verified via CRC-32, Zod schemas, SHA-256 checksums, and binary
              magic-byte inspection before anything changes.
            </p>
          </div>

          {importError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2 text-xs text-[var(--aurora-error)]"
            >
              <MaterialSymbol name="error" size={16} />
              <span>{importError}</span>
            </div>
          )}

          {inspectedBundle && (
            <div className="space-y-4 rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--aurora-success)]">
                    Archive Verified Ready to Import
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--aurora-text-muted)]">
                    Exported {inspectedBundle.manifest.exportedAt.slice(0, 10)} • Schema v
                    {inspectedBundle.summary.sourceSchemaVersion}
                    {inspectedBundle.summary.migratedFromLegacy ? ' (auto-upgraded to v5)' : ''}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--aurora-primary)]/18 px-2.5 py-0.5 text-[11px] font-medium text-[var(--aurora-primary)]">
                  {inspectedBundle.summary.assetCount} asset(s) •{' '}
                  {formatKilobytes(inspectedBundle.summary.totalAssetBytes)}
                </span>
              </div>

              <div className="text-xs text-[var(--aurora-text-secondary)]">
                <span className="font-medium text-[var(--aurora-text)]">Profiles included:</span>{' '}
                {inspectedBundle.summary.profileNames.join(', ')}
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                  Import Mode
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('import-as-new');
                      setConfirmDestructive(false);
                    }}
                    aria-pressed={importMode === 'import-as-new'}
                    className={`aurora-focus-ring cursor-pointer rounded-xl border p-2.5 text-left text-xs ${
                      importMode === 'import-as-new'
                        ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/14'
                        : 'border-[var(--aurora-border)]'
                    }`}
                  >
                    <p className="font-semibold text-[var(--aurora-text)]">Add as New Profile</p>
                    <p className="mt-0.5 text-[10px] text-[var(--aurora-text-muted)]">
                      Non-destructive; preserves existing profiles.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('replace-profile');
                      setConfirmDestructive(false);
                    }}
                    aria-pressed={importMode === 'replace-profile'}
                    className={`aurora-focus-ring cursor-pointer rounded-xl border p-2.5 text-left text-xs ${
                      importMode === 'replace-profile'
                        ? 'border-[var(--aurora-warning)] bg-[var(--aurora-warning)]/14'
                        : 'border-[var(--aurora-border)]'
                    }`}
                  >
                    <p className="font-semibold text-[var(--aurora-text)]">Replace Active</p>
                    <p className="mt-0.5 text-[10px] text-[var(--aurora-text-muted)]">
                      Overwrites &ldquo;{activeProfile?.name}&rdquo;.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('restore-all');
                      setConfirmDestructive(false);
                    }}
                    aria-pressed={importMode === 'restore-all'}
                    className={`aurora-focus-ring cursor-pointer rounded-xl border p-2.5 text-left text-xs ${
                      importMode === 'restore-all'
                        ? 'border-[var(--aurora-error)] bg-[var(--aurora-error)]/14'
                        : 'border-[var(--aurora-border)]'
                    }`}
                  >
                    <p className="font-semibold text-[var(--aurora-text)]">Full Restore</p>
                    <p className="mt-0.5 text-[10px] text-[var(--aurora-text-muted)]">
                      Replaces all current workspace profiles.
                    </p>
                  </button>
                </div>
              </div>

              {confirmDestructive && (
                <div
                  role="alert"
                  className="rounded-xl border border-[var(--aurora-warning)]/50 bg-[var(--aurora-warning)]/14 p-3 text-xs text-[var(--aurora-warning)]"
                >
                  <p className="font-semibold">Confirm Overwrite</p>
                  <p className="mt-0.5">
                    {importMode === 'restore-all'
                      ? 'This will replace every profile in your workspace with the contents of this backup. Click "Confirm & Import" again to proceed.'
                      : `This will replace "${activeProfile?.name}" with the imported profile layout. Click "Confirm & Import" again to proceed.`}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInspectedBundle(null);
                    setConfirmDestructive(false);
                  }}
                >
                  Clear Selection
                </Button>
                <Button
                  type="button"
                  variant={confirmDestructive ? 'destructive' : 'primary'}
                  size="sm"
                  disabled={isImporting || isEditing}
                  onClick={() => void handleApplyImport()}
                >
                  <MaterialSymbol name="check_circle" size={16} />
                  <span>
                    {isImporting
                      ? 'Importing...'
                      : confirmDestructive
                        ? 'Confirm & Import'
                        : 'Apply Import'}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
