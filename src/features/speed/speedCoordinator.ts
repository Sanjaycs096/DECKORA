import {
  chromeStorageService,
  type ChromeStorageService,
} from '@/services/storage/chromeStorageService';
import type { SpeedCacheState, SpeedTestPhase } from '@/types/workspace';
import {
  executeBoundedSpeedTest,
  isSaveDataEnabled,
  type FetchLike,
  type NowLike,
} from './speedEngine';
import { checkSpeedTestPermission, type SpeedPermissionState } from './speedPermissions';

const STALE_RUNNING_LOCK_MS = 90_000;

let activeRunPromise: Promise<SpeedCacheState> | null = null;

function isPersistedRunFresh(cache: SpeedCacheState | null): boolean {
  if (!cache?.isRunning || !cache.runningStartedAt) return false;
  const startedMs = Date.parse(cache.runningStartedAt);
  if (!Number.isFinite(startedMs)) return false;
  return Date.now() - startedMs < STALE_RUNNING_LOCK_MS;
}

export async function updateSpeedCacheInStorage(
  nextSpeedCache: SpeedCacheState,
  service: ChromeStorageService = chromeStorageService,
): Promise<SpeedCacheState> {
  const { state } = await service.readWorkspace();
  const nextState = {
    ...state,
    revision: state.revision + 1,
    updatedAt: new Date().toISOString(),
    speedCache: nextSpeedCache,
  };
  const saved = await service.writeWorkspace(nextState);
  return saved.speedCache ?? nextSpeedCache;
}

export async function markSpeedPermissionRevoked(
  service: ChromeStorageService = chromeStorageService,
): Promise<SpeedCacheState> {
  const { state } = await service.readWorkspace();
  const prev = state.speedCache;
  return updateSpeedCacheInStorage(
    {
      status: 'permission-required',
      phase: 'idle',
      isRunning: false,
      runningStartedAt: null,
      lastAttemptAt: prev?.lastAttemptAt ?? null,
      lastSuccessfulResult: prev?.lastSuccessfulResult ?? null,
      errorMessage: 'Cloudflare Speed Test host permission is required.',
    },
    service,
  );
}

export interface RunSpeedMonitorOptions {
  source: 'manual' | 'alarm';
  downloadProbeBytes?: number;
  uploadProbeBytes?: number;
  service?: ChromeStorageService;
  fetchImpl?: FetchLike;
  nowImpl?: NowLike;
  permissionCheckImpl?: () => Promise<SpeedPermissionState>;
  onPhaseChange?: (phase: SpeedTestPhase) => void;
  onCacheUpdated?: (cache: SpeedCacheState) => void;
}

export async function runAndPersistSpeedTest(
  options: RunSpeedMonitorOptions,
): Promise<SpeedCacheState> {
  if (activeRunPromise) {
    return activeRunPromise;
  }

  const service = options.service ?? chromeStorageService;
  const permissionCheck = options.permissionCheckImpl ?? checkSpeedTestPermission;

  const task = (async (): Promise<SpeedCacheState> => {
    const { state } = await service.readWorkspace();
    const prevCache = state.speedCache;
    const preservedResult = prevCache?.lastSuccessfulResult ?? null;

    if (isPersistedRunFresh(prevCache)) {
      return prevCache!;
    }

    const permission = await permissionCheck();
    if (permission === 'denied') {
      const cache: SpeedCacheState = {
        status: 'permission-required',
        phase: 'idle',
        isRunning: false,
        runningStartedAt: null,
        lastAttemptAt: new Date().toISOString(),
        lastSuccessfulResult: preservedResult,
        errorMessage: 'Enable optional Cloudflare endpoint permission to run speed tests.',
      };
      const persisted = await updateSpeedCacheInStorage(cache, service);
      options.onCacheUpdated?.(persisted);
      return persisted;
    }

    if (permission === 'unavailable' && typeof chrome !== 'undefined' && chrome.runtime?.id) {
      const cache: SpeedCacheState = {
        status: 'permission-required',
        phase: 'idle',
        isRunning: false,
        runningStartedAt: null,
        lastAttemptAt: new Date().toISOString(),
        lastSuccessfulResult: preservedResult,
        errorMessage: 'Host permission unavailable in extension runtime.',
      };
      const persisted = await updateSpeedCacheInStorage(cache, service);
      options.onCacheUpdated?.(persisted);
      return persisted;
    }

    if (options.source === 'alarm' && isSaveDataEnabled()) {
      return (
        prevCache ?? {
          status: preservedResult ? 'completed' : 'idle',
          phase: 'idle',
          isRunning: false,
          runningStartedAt: null,
          lastAttemptAt: null,
          lastSuccessfulResult: preservedResult,
          errorMessage: null,
        }
      );
    }

    const startedAt = new Date().toISOString();
    const testingCache: SpeedCacheState = {
      status: 'testing',
      phase: 'ping',
      isRunning: true,
      runningStartedAt: startedAt,
      lastAttemptAt: startedAt,
      lastSuccessfulResult: preservedResult,
      errorMessage: null,
    };
    options.onCacheUpdated?.(await updateSpeedCacheInStorage(testingCache, service));

    const result = await executeBoundedSpeedTest({
      source: options.source,
      downloadProbeBytes: options.downloadProbeBytes ?? 2_097_152,
      uploadProbeBytes: options.uploadProbeBytes ?? 524_288,
      fetchImpl: options.fetchImpl,
      nowImpl: options.nowImpl,
      onPhaseChange: (phase) => {
        options.onPhaseChange?.(phase);
      },
    });

    if (result.ok) {
      const completedCache: SpeedCacheState = {
        status: 'completed',
        phase: 'complete',
        isRunning: false,
        runningStartedAt: null,
        lastAttemptAt: result.measurement.measuredAt,
        lastSuccessfulResult: result.measurement,
        errorMessage: null,
      };
      const saved = await updateSpeedCacheInStorage(completedCache, service);
      options.onCacheUpdated?.(saved);
      return saved;
    }

    const failedCache: SpeedCacheState = {
      status: result.status,
      phase: 'idle',
      isRunning: false,
      runningStartedAt: null,
      lastAttemptAt: new Date().toISOString(),
      lastSuccessfulResult: preservedResult,
      errorMessage: result.errorMessage,
    };
    const saved = await updateSpeedCacheInStorage(failedCache, service);
    options.onCacheUpdated?.(saved);
    return saved;
  })();

  activeRunPromise = task;
  try {
    return await task;
  } finally {
    activeRunPromise = null;
  }
}
