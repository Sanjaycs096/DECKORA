import type { PersistedWorkspaceState } from '@/types/workspace';
import { validateLayoutIntegrity } from '@/features/editor/layoutOps';
import { createDefaultWorkspaceState } from './defaults';
import { persistedWorkspaceSchema, validateAndMigrateWorkspace } from './schemas';

export const WORKSPACE_STORAGE_KEY = 'aurora_workspace_v1';

/**
 * Guardrail ensuring binary assets or base64 blobs are never written into chrome.storage.local.
 * Heavy assets belong exclusively in IndexedDB (`aurora-assets-db`).
 */
export const MAX_METADATA_PAYLOAD_BYTES = 512 * 1024; // 512 KB strict guardrail

export interface StorageBackendAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export class StorageServiceError extends Error {
  readonly code: 'VALIDATION_FAILED' | 'PAYLOAD_TOO_LARGE' | 'BACKEND_ERROR';

  constructor(
    code: 'VALIDATION_FAILED' | 'PAYLOAD_TOO_LARGE' | 'BACKEND_ERROR',
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'StorageServiceError';
    this.code = code;
  }
}

function createDefaultStorageAdapter(): StorageBackendAdapter {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return {
      async get(key: string) {
        const result = await chrome.storage.local.get(key);
        return result[key];
      },
      async set(key: string, value: unknown) {
        await chrome.storage.local.set({ [key]: value });
      },
      async remove(key: string) {
        await chrome.storage.local.remove(key);
      },
    };
  }

  // Fallback for Vite web preview / unit test environments outside Chrome extension context
  const memoryFallback = new Map<string, unknown>();
  return {
    get(key: string) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(key);
        if (!raw) return Promise.resolve(undefined);
        try {
          return Promise.resolve(JSON.parse(raw) as unknown);
        } catch {
          return Promise.resolve(undefined);
        }
      }
      return Promise.resolve(memoryFallback.get(key));
    },
    set(key: string, value: unknown) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      } else {
        memoryFallback.set(key, value);
      }
      return Promise.resolve();
    },
    remove(key: string) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      } else {
        memoryFallback.delete(key);
      }
      return Promise.resolve();
    },
  };
}

export interface ReadWorkspaceResult {
  state: PersistedWorkspaceState;
  recoveredFromInvalid: boolean;
  recoveryReason?: string;
}

export class ChromeStorageService {
  private readonly adapter: StorageBackendAdapter;

  constructor(adapter?: StorageBackendAdapter) {
    this.adapter = adapter ?? createDefaultStorageAdapter();
  }

  async initialize(): Promise<ReadWorkspaceResult> {
    const existing = await this.adapter.get(WORKSPACE_STORAGE_KEY);
    if (existing === undefined || existing === null) {
      const defaults = createDefaultWorkspaceState();
      await this.writeWorkspace(defaults);
      return { state: defaults, recoveredFromInvalid: false };
    }

    const migration = validateAndMigrateWorkspace(existing);
    if (!migration.ok) {
      const defaults = createDefaultWorkspaceState();
      await this.writeWorkspace(defaults);
      return {
        state: defaults,
        recoveredFromInvalid: true,
        recoveryReason: migration.error,
      };
    }

    if (migration.migrated) {
      await this.writeWorkspace(migration.state);
    }

    return { state: migration.state, recoveredFromInvalid: false };
  }

  async readWorkspace(): Promise<ReadWorkspaceResult> {
    try {
      return await this.initialize();
    } catch (error) {
      throw new StorageServiceError(
        'BACKEND_ERROR',
        'Failed to read workspace from Chrome storage.',
        error,
      );
    }
  }

  async writeWorkspace(state: PersistedWorkspaceState): Promise<PersistedWorkspaceState> {
    const parsed = persistedWorkspaceSchema.safeParse(state);
    if (!parsed.success) {
      throw new StorageServiceError(
        'VALIDATION_FAILED',
        `Cannot save invalid workspace state: ${parsed.error.issues[0]?.message ?? 'unknown error'}`,
      );
    }

    for (const [profileId, profile] of Object.entries(parsed.data.profiles)) {
      const integrity = validateLayoutIntegrity(profile.layout);
      if (!integrity.valid) {
        throw new StorageServiceError(
          'VALIDATION_FAILED',
          `Cannot save invalid layout in profile "${profileId}": ${integrity.errors[0] ?? 'integrity check failed'}`,
        );
      }
    }

    const serialized = JSON.stringify(parsed.data);
    const byteLength = new TextEncoder().encode(serialized).byteLength;
    if (byteLength > MAX_METADATA_PAYLOAD_BYTES) {
      throw new StorageServiceError(
        'PAYLOAD_TOO_LARGE',
        `Workspace metadata (${byteLength} bytes) exceeds 512 KB chrome.storage.local guardrail. Store binary assets in IndexedDB.`,
      );
    }

    try {
      await this.adapter.set(WORKSPACE_STORAGE_KEY, parsed.data);
      return parsed.data;
    } catch (error) {
      throw new StorageServiceError(
        'BACKEND_ERROR',
        'Failed to write workspace to Chrome storage.',
        error,
      );
    }
  }

  async resetWorkspace(): Promise<PersistedWorkspaceState> {
    const defaults = createDefaultWorkspaceState();
    return this.writeWorkspace(defaults);
  }
}

export const chromeStorageService = new ChromeStorageService();
