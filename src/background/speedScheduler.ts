import { runAndPersistSpeedTest } from '@/features/speed/speedCoordinator';
import type { ChromeStorageService } from '@/services/storage/chromeStorageService';
import { chromeStorageService } from '@/services/storage/chromeStorageService';
import { parseSpeedProps } from '@/services/storage/schemas';
import type { PersistedWorkspaceState, SpeedAutoIntervalMinutes } from '@/types/workspace';

export const AURORA_SPEED_ALARM_NAME = 'aurora-speed-monitor' as const;

export interface ActiveSpeedScheduleConfig {
  intervalMinutes: SpeedAutoIntervalMinutes;
  downloadProbeBytes: 1_048_576 | 2_097_152 | 5_242_880;
  uploadProbeBytes: 524_288 | 1_048_576;
}

export function extractActiveSpeedConfig(
  state: PersistedWorkspaceState,
): ActiveSpeedScheduleConfig {
  const activeProfile = state.profiles[state.activeProfileId];
  if (!activeProfile) {
    return {
      intervalMinutes: 0,
      downloadProbeBytes: 2_097_152,
      uploadProbeBytes: 524_288,
    };
  }

  let bestInterval: SpeedAutoIntervalMinutes = 0;
  let chosenDown: 1_048_576 | 2_097_152 | 5_242_880 = 2_097_152;
  let chosenUp: 524_288 | 1_048_576 = 524_288;

  for (const id of activeProfile.layout.zOrder) {
    const el = activeProfile.layout.elements[id];
    if (!el || el.type !== 'speed' || !el.visible) continue;
    const parsed = parseSpeedProps(el.props);
    if (
      parsed.autoMeasureIntervalMinutes > 0 &&
      (bestInterval === 0 || parsed.autoMeasureIntervalMinutes < bestInterval)
    ) {
      bestInterval = parsed.autoMeasureIntervalMinutes;
      chosenDown = parsed.downloadProbeBytes;
      chosenUp = parsed.uploadProbeBytes;
    }
  }

  return {
    intervalMinutes: bestInterval,
    downloadProbeBytes: chosenDown,
    uploadProbeBytes: chosenUp,
  };
}

export interface AlarmsApiLike {
  get: (name: string) => Promise<chrome.alarms.Alarm | undefined>;
  create: (name: string, alarmInfo: chrome.alarms.AlarmCreateInfo) => Promise<void> | void;
  clear: (name: string) => Promise<boolean>;
}

function getDefaultAlarmsApi(): AlarmsApiLike | null {
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    return chrome.alarms;
  }
  return null;
}

/**
 * Reconciles Chrome MV3 alarm registration without creating duplicates.
 * Automatic testing stays disabled when intervalMinutes === 0.
 */
export async function reconcileSpeedAlarm(
  state: PersistedWorkspaceState,
  alarmsApi: AlarmsApiLike | null = getDefaultAlarmsApi(),
): Promise<'cleared' | 'unchanged' | 'scheduled' | 'unavailable'> {
  if (!alarmsApi) return 'unavailable';

  const config = extractActiveSpeedConfig(state);
  const existing = await alarmsApi.get(AURORA_SPEED_ALARM_NAME);

  if (config.intervalMinutes === 0) {
    if (existing) {
      await alarmsApi.clear(AURORA_SPEED_ALARM_NAME);
      return 'cleared';
    }
    return 'unchanged';
  }

  if (existing && existing.periodInMinutes === config.intervalMinutes) {
    return 'unchanged';
  }

  if (existing) {
    await alarmsApi.clear(AURORA_SPEED_ALARM_NAME);
  }

  await alarmsApi.create(AURORA_SPEED_ALARM_NAME, {
    delayInMinutes: config.intervalMinutes,
    periodInMinutes: config.intervalMinutes,
  });

  return 'scheduled';
}

export async function handleSpeedAlarmTrigger(
  service: ChromeStorageService = chromeStorageService,
  alarmsApi: AlarmsApiLike | null = getDefaultAlarmsApi(),
): Promise<boolean> {
  const { state } = await service.readWorkspace();
  const config = extractActiveSpeedConfig(state);

  if (config.intervalMinutes === 0) {
    await reconcileSpeedAlarm(state, alarmsApi);
    return false;
  }

  await runAndPersistSpeedTest({
    source: 'alarm',
    downloadProbeBytes: config.downloadProbeBytes,
    uploadProbeBytes: config.uploadProbeBytes,
    service,
  });

  return true;
}
