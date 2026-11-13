import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { createDefaultWorkspaceState } from '@/services/storage/defaults';
import {
  AURORA_SPEED_ALARM_NAME,
  handleSpeedAlarmTrigger,
  reconcileSpeedAlarm,
} from './speedScheduler';

function createMemoryAdapter(initial?: Record<string, unknown>): StorageBackendAdapter {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}));
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

describe('Background Speed Alarm Scheduler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('clears alarms when active profile schedule is Manual Only (0) and avoids redundant creates', async () => {
    let existingAlarm: chrome.alarms.Alarm | undefined;
    const createMock = vi.fn((name: string, info: chrome.alarms.AlarmCreateInfo) => {
      existingAlarm = {
        name,
        scheduledTime: Date.now() + (info.periodInMinutes ?? 15) * 60_000,
        periodInMinutes: info.periodInMinutes,
      };
    });
    const clearMock = vi.fn(() => {
      const had = Boolean(existingAlarm);
      existingAlarm = undefined;
      return Promise.resolve(had);
    });
    const getMock = vi.fn(() => Promise.resolve(existingAlarm));

    const alarmsApi = {
      get: getMock,
      create: createMock,
      clear: clearMock,
    };

    // Default state has interval = 0 (Manual Only)
    const defaultState = createDefaultWorkspaceState();
    const res1 = await reconcileSpeedAlarm(defaultState, alarmsApi);
    expect(res1).toBe('unchanged');
    expect(createMock).not.toHaveBeenCalled();

    // Update speed element schedule to every 15 minutes
    const scheduledState = createDefaultWorkspaceState();
    const speedEl =
      scheduledState.profiles['profile-personal']!.layout.elements['el-speed-default']!;
    speedEl.props = { ...speedEl.props, autoMeasureIntervalMinutes: 15 };

    const res2 = await reconcileSpeedAlarm(scheduledState, alarmsApi);
    expect(res2).toBe('scheduled');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(AURORA_SPEED_ALARM_NAME, {
      delayInMinutes: 15,
      periodInMinutes: 15,
    });

    // Reconciling again with the same 15-minute period must NOT duplicate alarm creation
    const res3 = await reconcileSpeedAlarm(scheduledState, alarmsApi);
    expect(res3).toBe('unchanged');
    expect(createMock).toHaveBeenCalledTimes(1);

    // Changing back to 0 clears the active alarm
    const res4 = await reconcileSpeedAlarm(defaultState, alarmsApi);
    expect(res4).toBe('cleared');
    expect(clearMock).toHaveBeenCalledWith(AURORA_SPEED_ALARM_NAME);
  });

  it('skips scheduled execution when active schedule is Manual Only', async () => {
    const adapter = createMemoryAdapter();
    const service = new ChromeStorageService(adapter);
    await service.initialize();

    const executed = await handleSpeedAlarmTrigger(service, {
      get: () => Promise.resolve(undefined),
      create: vi.fn(),
      clear: () => Promise.resolve(false),
    });

    expect(executed).toBe(false);
  });
});
