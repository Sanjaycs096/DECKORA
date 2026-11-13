import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useThemeStore } from '@/state/themeStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { App } from './App';

describe('DECKORA Default New Tab App Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useEditorSessionStore.setState(useEditorSessionStore.getInitialState());
  });

  it('renders Deckora View Mode with 5-control header, full viewport, zero footer, and zero legacy AURORA copy', () => {
    const { container } = render(<App />);

    expect(container.querySelector('footer')).toBeNull();
    expect(screen.queryByText(/AURORA/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/DECKORA — Your Personal Browser Workspace/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Press \/ to search/i)).not.toBeInTheDocument();

    const header = screen.getByRole('banner', { name: 'Primary workspace navigation' });
    expect(within(header).getByRole('button', { name: 'Bookmarks' })).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Gmail' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Workspace profiles' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Edit workspace' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Google Apps' })).toBeInTheDocument();
    expect(within(header).getAllByRole('button')).toHaveLength(4);
    expect(within(header).getAllByRole('link')).toHaveLength(1);

    // Removed header controls stay out of View Mode
    expect(screen.queryByRole('button', { name: 'About Deckora' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Google Images' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Google Account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Theme:/i })).not.toBeInTheDocument();

    expect(screen.getByRole('region', { name: 'Clock and date' })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Web search' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Quick shortcuts' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Internet Speed Monitor' })).toBeInTheDocument();

    const outerContainer = container.querySelector('.min-h-dvh');
    expect(outerContainer).not.toBeNull();
  });

  it('hosts transactional Theme & Appearance controls inside Edit Mode with Undo, Discard, Save, and About Deckora', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().status).toBe('ready');
    });

    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));
    expect(screen.getByRole('banner', { name: 'Master Edit Mode toolbar' })).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeNull();
    expect(screen.queryByText(/AURORA/i)).not.toBeInTheDocument();

    // Switch to Light via Inspector Appearance buttons -> live preview updates DOM immediately
    const inspector = screen.getByRole('complementary', { name: 'Properties inspector' });
    await user.click(within(inspector).getByRole('button', { name: 'Light' }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(useEditorSessionStore.getState().isDirty).toBe(true);
    });

    // Undo restores Dark draft appearance
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    // Redo restores Light draft appearance
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    // Discard restores saved Dark theme without persisting
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }));
    await waitFor(() => {
      expect(useEditorSessionStore.getState().isEditing).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(useThemeStore.getState().resolvedAppearance).toBe('dark');
    });

    // Re-enter Edit Mode, switch to Light via Toolbar Appearance dropdown, open About Deckora, then Save
    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));
    await user.click(screen.getByRole('button', { name: /Appearance & Theme:/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'About Deckora...' }));

    const aboutDialog = await screen.findByRole('dialog');
    expect(within(aboutDialog).getByText('Your Personal Browser Workspace')).toBeInTheDocument();
    expect(within(aboutDialog).getByText('#7FD3F7')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /Appearance & Theme:/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Light (Ice Crystal)' }));

    await user.click(screen.getByRole('button', { name: 'Save workspace layout' }));
    await waitFor(() => {
      expect(useEditorSessionStore.getState().isEditing).toBe(false);
      expect(useThemeStore.getState().resolvedAppearance).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });
  });
});
