import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { NAV_DESTINATIONS } from './navDestinations';
import { TopNavigation } from './TopNavigation';

describe('TopNavigation & GoogleAppsPopover', () => {
  beforeEach(() => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  it('renders strictly the 5 top-header controls and excludes all removed navigation items', async () => {
    const user = userEvent.setup();
    const onOpenBookmarks = vi.fn(() => true);

    render(
      <TooltipProvider>
        <TopNavigation onOpenBookmarks={onOpenBookmarks} />
      </TooltipProvider>,
    );

    const header = screen.getByRole('banner', { name: 'Primary workspace navigation' });
    const leftNav = within(header).getByRole('navigation', { name: 'Workspace shortcuts' });

    // Left: strictly Bookmarks and Gmail
    expect(within(leftNav).getByRole('button', { name: 'Bookmarks' })).toBeInTheDocument();
    expect(within(leftNav).getByRole('link', { name: 'Gmail' })).toHaveAttribute(
      'href',
      NAV_DESTINATIONS.gmail,
    );
    expect(within(leftNav).getAllByRole('button')).toHaveLength(1);
    expect(within(leftNav).getAllByRole('link')).toHaveLength(1);

    // Right: strictly Workspace profiles, Edit, Google Apps
    expect(within(header).getByRole('button', { name: 'Workspace profiles' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Edit workspace' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Google Apps' })).toBeInTheDocument();

    // Total interactive controls in header: 4 buttons + 1 link = 5 controls
    expect(within(header).getAllByRole('button')).toHaveLength(4);
    expect(within(header).getAllByRole('link')).toHaveLength(1);

    // Removed controls must be absent from main View Mode header
    expect(screen.queryByRole('button', { name: 'About Deckora' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Google Images' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Theme:/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Google Account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Customize wallpaper' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bookmarks' }));
    expect(onOpenBookmarks).toHaveBeenCalledTimes(1);
  });

  it('opens searchable grouped Google Apps launcher and closes on Escape or outside click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <TooltipProvider>
        <div>
          <TopNavigation onNavigate={onNavigate} />
          <button type="button">Outside target</button>
        </div>
      </TooltipProvider>,
    );

    const appsBtn = screen.getByRole('button', { name: 'Google Apps' });
    await user.click(appsBtn);

    const launcher = screen.getByRole('dialog', { name: 'Google Apps Launcher' });
    expect(launcher).toBeVisible();
    expect(within(launcher).getByRole('region', { name: 'Core' })).toBeInTheDocument();
    expect(within(launcher).getByRole('region', { name: 'Productivity' })).toBeInTheDocument();
    expect(within(launcher).getByRole('region', { name: 'Media & Discovery' })).toBeInTheDocument();
    expect(within(launcher).getByRole('region', { name: 'Learning & Tools' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/',
    );
    expect(screen.getByRole('link', { name: 'Scholar' })).toHaveAttribute(
      'href',
      'https://scholar.google.com/',
    );

    // Search/filter narrows visible apps live
    const searchInput = within(launcher).getByLabelText('Search Google Apps');
    await user.type(searchInput, 'scholar');
    expect(within(launcher).getByRole('link', { name: 'Scholar' })).toBeInTheDocument();
    expect(within(launcher).queryByRole('link', { name: 'YouTube' })).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'no-such-google-app-xyz');
    expect(within(launcher).getByText(/No Google apps matched/i)).toBeInTheDocument();

    // Escape closes and returns focus to trigger
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Google Apps Launcher' })).not.toBeInTheDocument();
    expect(appsBtn).toHaveFocus();

    // Outside click closes popover
    await user.click(appsBtn);
    expect(screen.getByRole('dialog', { name: 'Google Apps Launcher' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Outside target' }));
    expect(screen.queryByRole('dialog', { name: 'Google Apps Launcher' })).not.toBeInTheDocument();
  });

  it('navigates when a Google App service is selected', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <TooltipProvider>
        <TopNavigation onNavigate={onNavigate} />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Google Apps' }));
    await user.click(screen.getByRole('link', { name: 'Maps' }));

    expect(onNavigate).toHaveBeenCalledWith('https://maps.google.com/');
    expect(screen.queryByRole('dialog', { name: 'Google Apps Launcher' })).not.toBeInTheDocument();
  });
});
