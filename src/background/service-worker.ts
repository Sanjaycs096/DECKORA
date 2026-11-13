import { markSpeedPermissionRevoked } from '@/features/speed/speedCoordinator';
import { CLOUDFLARE_SPEED_ORIGIN } from '@/features/speed/speedPermissions';
import {
  WORKSPACE_STORAGE_KEY,
  chromeStorageService,
} from '@/services/storage/chromeStorageService';
import { validateAndMigrateWorkspace } from '@/services/storage/schemas';
import {
  AURORA_SPEED_ALARM_NAME,
  handleSpeedAlarmTrigger,
  reconcileSpeedAlarm,
} from './speedScheduler';

async function initializeAndReconcile(reason: string): Promise<void> {
  try {
    const { state } = await chromeStorageService.initialize();
    await reconcileSpeedAlarm(state);
    console.info(`[DECKORA SW] Workspace ready (${reason}, schema v${state.schemaVersion}).`);
  } catch (error) {
    console.error(`[DECKORA SW] Initialization failed (${reason}):`, error);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  void initializeAndReconcile(details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  void initializeAndReconcile('startup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AURORA_SPEED_ALARM_NAME) return;
  void handleSpeedAlarmTrigger().catch((error) => {
    console.error('[DECKORA SW] Alarm speed check failed:', error);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const workspaceChange = changes[WORKSPACE_STORAGE_KEY];
  if (!workspaceChange?.newValue) return;

  const migrated = validateAndMigrateWorkspace(workspaceChange.newValue);
  if (migrated.ok) {
    void reconcileSpeedAlarm(migrated.state).catch((error) => {
      console.warn('[DECKORA SW] Failed to reconcile speed alarm after storage change:', error);
    });
  }
});

if (chrome.permissions?.onRemoved) {
  chrome.permissions.onRemoved.addListener((removed) => {
    if (removed.origins?.includes(CLOUDFLARE_SPEED_ORIGIN)) {
      void markSpeedPermissionRevoked()
        .then(() => chrome.alarms.clear(AURORA_SPEED_ALARM_NAME))
        .catch((error) => {
          console.warn('[DECKORA SW] Failed updating revoked speed permission state:', error);
        });
    }
  });
}
