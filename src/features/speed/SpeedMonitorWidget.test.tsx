import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { AURORA_SPEED_ALARM_NAME } from '@/background/speedScheduler';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { DEFAULT_SPEED_ELEMENT_ID } from '@/services/storage/defaults';
import { useEditorSessionStore } from '@/state/editorSessionStore';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { SpeedMonitorWidget } from './SpeedMonitorWidget';

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function createMemoryAdapter(): StorageBackendAdapter {
  const store = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

describe('SpeedMonitorWidget Permission Consent & States', () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    const service = new ChromeStorageService(createMemoryAdapter());
    await useWorkspaceStore.getState().hydrate(service);
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('requires explicit user opt-in before contacting Cloudflare endpoints and handles permission grant', async () => {
    const containsMock = vi.fn(() => Promise.resolve(false));
    const requestMock = vi.fn(() => Promise.resolve(true));

    globalThis.chrome = {
      permissions: {
        contains: containsMock,
        request: requestMock,
      },
    } as unknown as typeof chrome;

    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = toUrlString(input);
      if (url.includes('__down?bytes=0')) {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      if (url.includes('__down?bytes=')) {
        return Promise.resolve(new Response(new Uint8Array(1_048_576), { status: 200 }));
      }
      return Promise.resolve(new Response('ok', { status: 200 }));
    });
    globalThis.fetch = fetchMock;

    const speedElement = useWorkspaceStore.getState().getActiveProfile()!.layout.elements[
      DEFAULT_SPEED_ELEMENT_ID
    ]!;

    const user = userEvent.setup();
    render(<SpeedMonitorWidget element={speedElement} />);

    // Must explain optional permission and must NOT run any fetch on initial mount
    const enableBtn = await screen.findByRole('button', { name: 'Enable Speed Test' });
    expect(enableBtn).toBeInTheDocument();
    expect(screen.getByText(/speed\.cloudflare\.com/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // Grant permission after explicit click
    containsMock.mockResolvedValue(true);
    await user.click(enableBtn);

    expect(requestMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Manual •/i)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('shows decline message without nagging when permission is denied and disables actions in Edit Preview', async () => {
    const containsMock = vi.fn(() => Promise.resolve(false));
    const requestMock = vi.fn(() => Promise.resolve(false));
    globalThis.chrome = {
      permissions: {
        contains: containsMock,
        request: requestMock,
      },
    } as unknown as typeof chrome;

    const fetchMock = vi.fn<typeof fetch>();
    globalThis.fetch = fetchMock;

    const speedElement = useWorkspaceStore.getState().getActiveProfile()!.layout.elements[
      DEFAULT_SPEED_ELEMENT_ID
    ]!;

    const user = userEvent.setup();
    const { rerender } = render(<SpeedMonitorWidget element={speedElement} />);

    const enableBtn = await screen.findByRole('button', { name: 'Enable Speed Test' });
    await user.click(enableBtn);

    expect(await screen.findByText(/permission not granted/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // Edit Preview mode: renders layout preview cleanly without network requests or interactive run trigger
    rerender(<SpeedMonitorWidget element={speedElement} editPreview />);
    expect(screen.getByRole('button', { name: /Run Speed Test/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isolates Speed Monitor Inspector schedule edits to draft until Save and reconciles alarms on commit', async () => {
    window.localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
    useEditorSessionStore.setState(useEditorSessionStore.getInitialState());

    const clearMock = vi.fn(() => Promise.resolve(false));
    const createMock = vi.fn();
    const getMock = vi.fn(() => Promise.resolve(undefined));
    globalThis.chrome = {
      alarms: {
        get: getMock,
        create: createMock,
        clear: clearMock,
      },
      permissions: {
        contains: vi.fn(() => Promise.resolve(true)),
        request: vi.fn(() => Promise.resolve(true)),
      },
    } as unknown as typeof chrome;

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().status).toBe('ready');
    });

    await user.click(screen.getByRole('button', { name: 'Edit workspace' }));

    // Select Speed Monitor layer
    await user.click(
      document.querySelector(`[data-layer-id="${DEFAULT_SPEED_ELEMENT_ID}"] button`)!,
    );

    const scheduleSelect = await screen.findByRole('combobox', { name: 'Auto-measure schedule' });
    await user.click(scheduleSelect);
    await user.click(await screen.findByRole('menuitem', { name: 'Every 30 minutes' }));

    // Draft is dirty at 30, committed workspace still remains at 0 (Manual Only)
    expect(
      useEditorSessionStore.getState().draftLayout?.elements[DEFAULT_SPEED_ELEMENT_ID]?.props
        .autoMeasureIntervalMinutes,
    ).toBe(30);
    expect(
      useWorkspaceStore.getState().getActiveProfile()?.layout.elements[DEFAULT_SPEED_ELEMENT_ID]
        ?.props.autoMeasureIntervalMinutes,
    ).toBe(0);
    expect(createMock).not.toHaveBeenCalled();

    // Commit draft -> persists 30 and schedules background alarm
    await user.click(screen.getByRole('button', { name: 'Save workspace layout' }));
    await waitFor(() => {
      expect(useEditorSessionStore.getState().isEditing).toBe(false);
    });

    expect(
      useWorkspaceStore.getState().getActiveProfile()?.layout.elements[DEFAULT_SPEED_ELEMENT_ID]
        ?.props.autoMeasureIntervalMinutes,
    ).toBe(30);
    expect(createMock).toHaveBeenCalledWith(AURORA_SPEED_ALARM_NAME, {
      delayInMinutes: 30,
      periodInMinutes: 30,
    });
  });
});
