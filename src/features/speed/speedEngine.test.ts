import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChromeStorageService,
  type StorageBackendAdapter,
} from '@/services/storage/chromeStorageService';
import { markSpeedPermissionRevoked, runAndPersistSpeedTest } from './speedCoordinator';
import {
  calculateMbps,
  computeJitterMs,
  computeMedian,
  executeBoundedSpeedTest,
  type FetchLike,
} from './speedEngine';

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

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

describe('Internet Speed Engine & Coordinator (Mocked Network)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes Mbps, median latency, and jitter accurately', () => {
    // 1,000,000 bytes in 1,000ms = 8 Mbps
    expect(calculateMbps(1_000_000, 1000)).toBe(8);
    expect(calculateMbps(0, 1000)).toBe(0);

    expect(computeMedian([12, 40, 18])).toBe(18);
    expect(computeMedian([10, 20, 30, 40])).toBe(25);
    expect(computeJitterMs([10, 14, 12])).toBe(3);
  });

  it('executes bounded ping, download, and upload probes against Cloudflare endpoints', async () => {
    let clock = 1000;
    const nowImpl = () => clock;

    const fetchImpl = vi.fn<FetchLike>((input, init) => {
      const url = toUrlString(input);
      if (url.includes('__down?bytes=0')) {
        clock += 20;
        return Promise.resolve(new Response('', { status: 200 }));
      }
      if (url.includes('__down?bytes=')) {
        clock += 200; // 1,048,576 bytes in 0.2s => ~41.94 Mbps
        return Promise.resolve(new Response(new Uint8Array(1_048_576), { status: 200 }));
      }
      if (url.includes('__up') && init?.method === 'POST') {
        clock += 400; // 524,288 bytes in 0.4s => ~10.49 Mbps
        return Promise.resolve(new Response('ok', { status: 200 }));
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    });

    const phases: string[] = [];
    const res = await executeBoundedSpeedTest({
      downloadProbeBytes: 1_048_576,
      uploadProbeBytes: 524_288,
      fetchImpl,
      nowImpl,
      onPhaseChange: (p) => phases.push(p),
      source: 'manual',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(phases).toEqual(['ping', 'download', 'upload', 'complete']);
    expect(res.measurement.pingMs).toBe(20);
    expect(res.measurement.jitterMs).toBe(0);
    expect(res.measurement.downloadMbps).toBeCloseTo(41.94, 1);
    expect(res.measurement.uploadMbps).toBeCloseTo(10.49, 1);
    expect(res.measurement.downloadBytes).toBe(1_048_576);
    expect(res.measurement.uploadBytes).toBe(524_288);
    expect(res.measurement.source).toBe('manual');
  });

  it('preserves lastSuccessfulResult when subsequent test fails, goes offline, or permission is revoked', async () => {
    const adapter = createMemoryAdapter();
    const service = new ChromeStorageService(adapter);
    await service.initialize();

    let clock = 500;
    const nowImpl = () => clock;
    const goodFetch = vi.fn<FetchLike>((input) => {
      const url = toUrlString(input);
      if (url.includes('__down?bytes=0')) {
        clock += 15;
        return Promise.resolve(new Response('', { status: 200 }));
      }
      if (url.includes('__down?bytes=')) {
        clock += 100;
        return Promise.resolve(new Response(new Uint8Array(1_048_576), { status: 200 }));
      }
      clock += 200;
      return Promise.resolve(new Response('ok', { status: 200 }));
    });

    const first = await runAndPersistSpeedTest({
      service,
      source: 'manual',
      permissionCheckImpl: () => Promise.resolve('granted'),
      fetchImpl: goodFetch,
      nowImpl,
    });

    expect(first.status).toBe('completed');
    expect(first.lastSuccessfulResult).not.toBeNull();
    const savedDownload = first.lastSuccessfulResult!.downloadMbps;

    // Subsequent network failure MUST keep lastSuccessfulResult intact
    const failingFetch = vi.fn<FetchLike>(() => Promise.reject(new Error('Network timeout')));
    const second = await runAndPersistSpeedTest({
      service,
      source: 'manual',
      permissionCheckImpl: () => Promise.resolve('granted'),
      fetchImpl: failingFetch,
    });

    expect(second.status).toBe('failed');
    expect(second.errorMessage).toContain('Network timeout');
    expect(second.lastSuccessfulResult?.downloadMbps).toBe(savedDownload);

    // Offline transition preserves lastSuccessfulResult
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const third = await runAndPersistSpeedTest({
      service,
      source: 'manual',
      permissionCheckImpl: () => Promise.resolve('granted'),
      fetchImpl: goodFetch,
    });
    expect(third.status).toBe('offline');
    expect(third.lastSuccessfulResult?.downloadMbps).toBe(savedDownload);
    onlineSpy.mockRestore();

    // Permission revocation preserves lastSuccessfulResult
    const fourth = await markSpeedPermissionRevoked(service);
    expect(fourth.status).toBe('permission-required');
    expect(fourth.lastSuccessfulResult?.downloadMbps).toBe(savedDownload);
  });

  it('prevents overlapping concurrent tests via single-flight lock', async () => {
    const adapter = createMemoryAdapter();
    const service = new ChromeStorageService(adapter);
    await service.initialize();

    let downCalls = 0;
    let clock = 100;
    const delayedFetch = vi.fn<FetchLike>((input) => {
      const url = toUrlString(input);
      if (url.includes('__down?bytes=') && !url.includes('bytes=0')) {
        downCalls += 1;
      }
      clock += 25;
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve(new Response(new Uint8Array(256_000), { status: 200 }));
        }, 20);
      });
    });

    const [a, b] = await Promise.all([
      runAndPersistSpeedTest({
        service,
        source: 'manual',
        permissionCheckImpl: () => Promise.resolve('granted'),
        fetchImpl: delayedFetch,
        nowImpl: () => clock,
      }),
      runAndPersistSpeedTest({
        service,
        source: 'manual',
        permissionCheckImpl: () => Promise.resolve('granted'),
        fetchImpl: delayedFetch,
        nowImpl: () => clock,
      }),
    ]);

    expect(downCalls).toBe(1);
    expect(a.status).toBe('completed');
    expect(b.status).toBe('completed');
  });
});
