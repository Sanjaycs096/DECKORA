import { useRef, useState } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToastStore,
} from '@/components/ui';
import { BookmarksDrawer } from '@/features/bookmarks/BookmarksDrawer';
import { PortabilityDialog } from '@/features/portability/PortabilityDialog';
import { ProfileManagerDialog } from '@/features/profiles/ProfileManagerDialog';
import { getProfilePresetMeta } from '@/features/profiles/profilePresets';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { GoogleAppsPopover } from './GoogleAppsPopover';
import { NAV_DESTINATIONS } from './navDestinations';

export interface TopNavigationProps {
  onOpenBookmarks?: () => boolean;
  onNavigate?: (url: string) => void;
}

export function TopNavigation({ onOpenBookmarks, onNavigate }: TopNavigationProps) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const switchProfile = useWorkspaceStore((s) => s.switchProfile);
  const enterEditMode = useEditorSessionStore((s) => s.enterEditMode);
  const pushToast = useToastStore((s) => s.push);

  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [portabilityOpen, setPortabilityOpen] = useState(false);

  const bookmarksTriggerRef = useRef<HTMLButtonElement>(null);

  const activeProfile = workspace.profiles[workspace.activeProfileId];
  const navigation = activeProfile?.navigation;
  const profiles = Object.values(workspace.profiles);
  const activePresetMeta = getProfilePresetMeta(activeProfile?.presetType ?? 'personal');

  if (navigation && !navigation.visible) {
    return null;
  }

  const handleBookmarksClick = () => {
    if (onOpenBookmarks) {
      onOpenBookmarks();
      return;
    }
    setBookmarksOpen((prev) => !prev);
  };

  const handleProfileSwitch = async (profileId: string, profileName: string) => {
    try {
      await switchProfile(profileId);
      pushToast({
        title: `Switched to ${profileName}`,
        variant: 'info',
      });
    } catch (error) {
      pushToast({
        title: 'Profile switch failed',
        description: error instanceof Error ? error.message : 'Unable to switch profile.',
        variant: 'error',
      });
    }
  };

  return (
    <header
      aria-label="Primary workspace navigation"
      className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between px-4 sm:px-6"
    >
      <nav aria-label="Workspace shortcuts" className="flex items-center gap-1.5 sm:gap-2">
        {(navigation?.showBookmarks ?? true) && (
          <button
            ref={bookmarksTriggerRef}
            type="button"
            onClick={handleBookmarksClick}
            aria-label="Bookmarks"
            aria-expanded={bookmarksOpen}
            aria-haspopup="dialog"
            className="aurora-focus-ring aurora-glass inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-xs font-medium text-[var(--aurora-text)] transition-all duration-[var(--aurora-duration-fast)] hover:border-[var(--aurora-border-highlight)]"
          >
            <MaterialSymbol name="bookmarks" size={17} className="text-[var(--aurora-primary)]" />
            <span className="hidden sm:inline">Bookmarks</span>
          </button>
        )}

        {(navigation?.showGmail ?? true) && (
          <a
            href={NAV_DESTINATIONS.gmail}
            aria-label="Gmail"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(NAV_DESTINATIONS.gmail);
              }
            }}
            className="aurora-focus-ring inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--aurora-text-secondary)] transition-colors duration-[var(--aurora-duration-fast)] hover:bg-[var(--aurora-surface)] hover:text-[var(--aurora-text)]"
          >
            <MaterialSymbol name="mail" size={17} />
            <span className="hidden sm:inline">Gmail</span>
          </a>
        )}
      </nav>

      <div className="flex items-center gap-2">
        <Dropdown>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  aria-label="Workspace profiles"
                  className="aurora-focus-ring aurora-glass inline-flex h-9 max-w-44 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--aurora-text)] transition-all duration-[var(--aurora-duration-fast)] hover:border-[var(--aurora-border-highlight)]"
                >
                  <MaterialSymbol
                    name={activePresetMeta.icon}
                    size={16}
                    className="shrink-0 text-[var(--aurora-primary)]"
                  />
                  <span className="hidden truncate md:inline">
                    {activeProfile?.name ?? 'Personal'}
                  </span>
                  <MaterialSymbol
                    name="expand_more"
                    size={15}
                    className="shrink-0 text-[var(--aurora-text-muted)]"
                  />
                </button>
              </DropdownTrigger>
            </TooltipTrigger>
            <TooltipContent>Switch or manage workspace profiles</TooltipContent>
          </Tooltip>
          <DropdownContent align="end" className="min-w-56">
            <DropdownLabel>Profiles</DropdownLabel>
            {profiles.map((profile) => {
              const meta = getProfilePresetMeta(profile.presetType);
              const isActive = profile.id === workspace.activeProfileId;
              return (
                <DropdownItem
                  key={profile.id}
                  icon={meta.icon}
                  selected={isActive}
                  onSelect={() => {
                    if (!isActive) {
                      void handleProfileSwitch(profile.id, profile.name);
                    }
                  }}
                >
                  <span className="truncate">{profile.name}</span>
                </DropdownItem>
              );
            })}
            <DropdownSeparator />
            <DropdownItem icon="tune" onSelect={() => setProfilesOpen(true)}>
              Manage Profiles...
            </DropdownItem>
            <DropdownItem icon="import_export" onSelect={() => setPortabilityOpen(true)}>
              Export / Import Backup...
            </DropdownItem>
          </DropdownContent>
        </Dropdown>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => enterEditMode()}
              aria-label="Edit workspace"
              className="aurora-focus-ring aurora-glass inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--aurora-text)] transition-all duration-[var(--aurora-duration-fast)] hover:border-[var(--aurora-border-highlight)]"
            >
              <MaterialSymbol
                name="edit_square"
                size={17}
                className="text-[var(--aurora-primary)]"
              />
              <span className="hidden md:inline">Edit</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Edit workspace layout</TooltipContent>
        </Tooltip>

        {(navigation?.showAppsGrid ?? true) && <GoogleAppsPopover onNavigate={onNavigate} />}
      </div>

      <BookmarksDrawer
        open={bookmarksOpen}
        onOpenChange={setBookmarksOpen}
        onNavigate={onNavigate}
        triggerRef={bookmarksTriggerRef}
      />
      <ProfileManagerDialog
        open={profilesOpen}
        onOpenChange={setProfilesOpen}
        onOpenPortability={() => setPortabilityOpen(true)}
      />
      <PortabilityDialog open={portabilityOpen} onOpenChange={setPortabilityOpen} />
    </header>
  );
}
