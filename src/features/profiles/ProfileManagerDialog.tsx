import { useState, type FormEvent } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IconButton,
  Input,
  useToastStore,
} from '@/components/ui';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type { ProfilePresetType, WorkspaceProfile } from '@/types/workspace';
import { getProfilePresetMeta, PROFILE_PRESET_LIST } from './profilePresets';

export interface ProfileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPortability?: () => void;
}

export function ProfileManagerDialog({
  open,
  onOpenChange,
  onOpenPortability,
}: ProfileManagerDialogProps) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const createProfile = useWorkspaceStore((s) => s.createProfile);
  const renameProfile = useWorkspaceStore((s) => s.renameProfile);
  const duplicateProfile = useWorkspaceStore((s) => s.duplicateProfile);
  const switchProfile = useWorkspaceStore((s) => s.switchProfile);
  const deleteProfile = useWorkspaceStore((s) => s.deleteProfile);
  const isEditing = useEditorSessionStore((s) => s.isEditing);
  const pushToast = useToastStore((s) => s.push);

  const [selectedPreset, setSelectedPreset] = useState<ProfilePresetType>('work');
  const [newProfileName, setNewProfileName] = useState('Work');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<WorkspaceProfile | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const profileList = Object.values(workspace.profiles);
  const canDelete = profileList.length > 1;

  const handleCreateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      setErrorMessage('Save or discard your active Edit Mode draft before switching profiles.');
      return;
    }
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a profile name.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const created = await createProfile({
        name: trimmed,
        presetType: selectedPreset,
        switchTo: true,
      });
      pushToast({
        title: `Profile "${created.name}" created`,
        description: `Switched active workspace to ${created.name}.`,
        variant: 'success',
      });
      setNewProfileName('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create profile.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSwitch = async (profile: WorkspaceProfile) => {
    if (isEditing) {
      setErrorMessage('Save or discard your active Edit Mode draft before switching profiles.');
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await switchProfile(profile.id);
      pushToast({
        title: `Switched to "${profile.name}"`,
        variant: 'info',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to switch profile.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRenameSubmit = async (profileId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setErrorMessage('Profile name cannot be empty.');
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await renameProfile(profileId, trimmed);
      setEditingId(null);
      pushToast({ title: 'Profile renamed', variant: 'success' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to rename profile.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDuplicate = async (profile: WorkspaceProfile) => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const cloned = await duplicateProfile(profile.id);
      pushToast({
        title: `Duplicated as "${cloned.name}"`,
        description: 'Layout and theme settings cloned safely.',
        variant: 'success',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to duplicate profile.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteProfile) return;
    if (isEditing) {
      setErrorMessage('Save or discard your active Edit Mode draft before deleting a profile.');
      setConfirmDeleteProfile(null);
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const targetName = confirmDeleteProfile.name;
      const result = await deleteProfile(confirmDeleteProfile.id);
      setConfirmDeleteProfile(null);
      pushToast({
        title: `Deleted "${targetName}"`,
        description:
          result.purgedAssetIds.length > 0
            ? `Cleaned up ${result.purgedAssetIds.length} unused media asset(s); shared assets preserved.`
            : 'Shared assets referenced by other profiles were preserved.',
        variant: 'info',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete profile.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col overflow-hidden p-0">
          <div className="border-b border-[var(--aurora-border)] px-6 pt-6 pb-4">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-8">
                <div>
                  <DialogTitle>Workspace Profiles</DialogTitle>
                  <DialogDescription>
                    Isolate layouts, wallpapers, themes, and navigation across dedicated spaces.
                  </DialogDescription>
                </div>
                {onOpenPortability && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenPortability();
                    }}
                  >
                    <MaterialSymbol name="import_export" size={15} />
                    <span>Backup & Restore</span>
                  </Button>
                )}
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
            {isEditing && (
              <div
                role="note"
                className="flex items-center gap-2 rounded-xl border border-[var(--aurora-warning)]/40 bg-[var(--aurora-warning)]/12 px-3 py-2 text-xs text-[var(--aurora-warning)]"
              >
                <MaterialSymbol name="warning" size={16} />
                <span>
                  Master Edit Mode is active. Save or discard your current draft before switching or
                  deleting profiles.
                </span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-[var(--aurora-error)]/40 bg-[var(--aurora-error)]/12 px-3 py-2 text-xs text-[var(--aurora-error)]"
              >
                <MaterialSymbol name="error" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Existing Profiles List */}
            <section aria-label="Configured workspace profiles" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                  Your Profiles ({profileList.length})
                </h3>
              </div>

              <div className="space-y-2">
                {profileList.map((profile) => {
                  const isActive = profile.id === workspace.activeProfileId;
                  const meta = getProfilePresetMeta(profile.presetType);
                  const elementCount = Object.keys(profile.layout.elements).length;
                  const isRenaming = editingId === profile.id;

                  return (
                    <div
                      key={profile.id}
                      data-testid={`profile-row-${profile.id}`}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 transition-colors ${
                        isActive
                          ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/10'
                          : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/40'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10"
                          style={{ backgroundColor: `${profile.theme.accentColor}22` }}
                        >
                          <MaterialSymbol
                            name={meta.icon}
                            size={20}
                            style={{ color: profile.theme.accentColor }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                aria-label="Rename profile input"
                                value={editingName}
                                maxLength={60}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleRenameSubmit(profile.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingId(null);
                                  }
                                }}
                                className="h-8 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                disabled={isBusy}
                                onClick={() => void handleRenameSubmit(profile.id)}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-[var(--aurora-text)]">
                                  {profile.name}
                                </p>
                                <span className="rounded-full border border-[var(--aurora-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--aurora-text-secondary)]">
                                  {meta.label}
                                </span>
                                {isActive && (
                                  <span className="rounded-full bg-[var(--aurora-primary)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--aurora-primary)]">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-[var(--aurora-text-muted)]">
                                {elementCount} widget{elementCount === 1 ? '' : 's'} •{' '}
                                {profile.theme.appearance} appearance
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {!isRenaming && (
                        <div className="flex items-center gap-1">
                          {!isActive && (
                            <Button
                              type="button"
                              size="sm"
                              variant="glass"
                              disabled={isBusy || isEditing}
                              onClick={() => void handleSwitch(profile)}
                            >
                              Switch
                            </Button>
                          )}
                          <IconButton
                            icon="edit"
                            label={`Rename ${profile.name}`}
                            size="sm"
                            disabled={isBusy}
                            onClick={() => {
                              setEditingId(profile.id);
                              setEditingName(profile.name);
                            }}
                          />
                          <IconButton
                            icon="content_copy"
                            label={`Duplicate ${profile.name}`}
                            size="sm"
                            disabled={isBusy}
                            onClick={() => void handleDuplicate(profile)}
                          />
                          <IconButton
                            icon="delete"
                            label={`Delete ${profile.name}`}
                            size="sm"
                            disabled={!canDelete || isBusy || isEditing}
                            onClick={() => setConfirmDeleteProfile(profile)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Create New Profile from Preset */}
            <section
              aria-label="Create new workspace profile"
              className="space-y-3 border-t border-[var(--aurora-border)] pt-4"
            >
              <h3 className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
                Create New Profile
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PROFILE_PRESET_LIST.map((preset) => {
                  const active = selectedPreset === preset.presetType;
                  return (
                    <button
                      key={preset.presetType}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(preset.presetType);
                        setNewProfileName(preset.label);
                      }}
                      aria-pressed={active}
                      className={`aurora-focus-ring flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-left transition-colors ${
                        active
                          ? 'border-[var(--aurora-primary)] bg-[var(--aurora-primary)]/14'
                          : 'border-[var(--aurora-border)] bg-[var(--aurora-surface)]/35 hover:border-[var(--aurora-border-highlight)]'
                      }`}
                    >
                      <MaterialSymbol
                        name={preset.icon}
                        size={18}
                        style={{ color: preset.accentColor }}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--aurora-text)]">
                          {preset.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--aurora-text-muted)]">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={(e) => void handleCreateProfile(e)} className="flex gap-2">
                <Input
                  aria-label="New profile name"
                  placeholder="Enter profile name (e.g. Research, Weekend)..."
                  value={newProfileName}
                  maxLength={60}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
                <Button type="submit" variant="primary" disabled={isBusy || isEditing}>
                  <MaterialSymbol name="add" size={16} />
                  <span>Create & Switch</span>
                </Button>
              </form>
            </section>
          </div>

          <DialogFooter className="border-t border-[var(--aurora-border)] px-6 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmDeleteProfile)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmDeleteProfile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile &ldquo;{confirmDeleteProfile?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This permanently removes this profile&apos;s layout, theme, and shortcuts. Media
              assets still used by your remaining profiles are preserved automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteProfile(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy}
              onClick={() => void handleConfirmDelete()}
            >
              Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
