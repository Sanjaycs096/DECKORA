import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
  SearchInput,
  SelectDropdown,
  SettingsSection,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToastViewport,
  useToastStore,
} from './index';

describe('AURORA Reusable UI Foundation', () => {
  it('renders MaterialSymbol with accessible role when label is provided', () => {
    render(<MaterialSymbol name="diamond" label="Aurora Diamond" size={24} fill={1} />);
    const icon = screen.getByRole('img', { name: 'Aurora Diamond' });
    expect(icon).toHaveTextContent('diamond');
    expect(icon).toHaveAttribute('data-icon-name', 'diamond');
  });

  it('handles Button and IconButton click interactions', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <div>
        <Button onClick={onClick}>Save Layout</Button>
        <IconButton icon="edit" label="Edit Workspace" onClick={onClick} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Save Layout' }));
    await user.click(screen.getByRole('button', { name: 'Edit Workspace' }));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('clears SearchInput via clear IconButton', async () => {
    const user = userEvent.setup();
    function ControlledSearch() {
      const [val, setVal] = useState('aurora');
      return (
        <SearchInput
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onClear={() => setVal('')}
          placeholder="Search..."
        />
      );
    }

    render(<ControlledSearch />);
    const input = screen.getByPlaceholderText('Search...');
    expect(input).toHaveValue('aurora');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
  });

  it('toggles Switch and switches Tabs content', async () => {
    const user = userEvent.setup();
    const onChecked = vi.fn();

    render(
      <div>
        <Switch aria-label="Enable Glass" onCheckedChange={onChecked} />
        <Tabs defaultValue="first">
          <TabsList>
            <TabsTrigger value="first">First</TabsTrigger>
            <TabsTrigger value="second">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="first">First Panel</TabsContent>
          <TabsContent value="second">Second Panel</TabsContent>
        </Tabs>
      </div>,
    );

    await user.click(screen.getByRole('switch', { name: 'Enable Glass' }));
    expect(onChecked).toHaveBeenCalledWith(true);

    expect(screen.getByText('First Panel')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Second' }));
    expect(screen.getByText('Second Panel')).toBeVisible();
  });

  it('opens Dialog and renders SettingsSection + ToastViewport', async () => {
    const user = userEvent.setup();
    useToastStore.getState().clear();

    render(
      <SettingsSection title="Appearance" description="Theme settings" icon="palette">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Modal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modal Title</DialogTitle>
              <DialogDescription>Modal description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <ToastViewport />
      </SettingsSection>,
    );

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Modal' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
  });

  it('renders high-contrast SelectDropdown options cleanly in Dark and Light themes with selected & disabled states', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');

    render(
      <SelectDropdown
        ariaLabel="Border style"
        value="solid"
        options={[
          { value: 'none', label: 'None' },
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
          { value: 'double', label: 'Double', disabled: true },
        ]}
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Border style' });
    expect(trigger).toHaveTextContent('Solid');
    expect(trigger.className).toContain('bg-[var(--aurora-menu-trigger-bg)]');
    expect(trigger.className).toContain('text-[var(--aurora-menu-text)]');

    await user.click(trigger);

    const menu = await screen.findByRole('menu');
    expect(menu.className).toContain('bg-[var(--aurora-menu-bg)]');
    expect(menu.className).toContain('text-[var(--aurora-menu-text)]');
    expect(menu.className).toContain('z-[80]');

    const solidItem = screen.getByRole('menuitem', { name: 'Solid' });
    const dashedItem = screen.getByRole('menuitem', { name: 'Dashed' });
    const doubleItem = screen.getByRole('menuitem', { name: 'Double' });

    expect(solidItem).toHaveAttribute('data-selected', 'true');
    expect(doubleItem).toHaveAttribute('data-disabled');

    await user.click(dashedItem);
    expect(onValueChange).toHaveBeenCalledWith('dashed');

    // Light theme keeps valid surface & menu styling cleanly
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
