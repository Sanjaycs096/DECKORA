import type { SpeedMeasurement, SpeedTestPhase } from '@/types/workspace';

export const CLOUDFLARE_DOWNLOAD_ENDPOINT = 'https://speed.cloudflare.com/__down';
export const CLOUDFLARE_UPLOAD_ENDPOINT = 'https://speed.cloudflare.com/__up';

export const DEFAULT_PING_SAMPLES = 3;
export const DEFAULT_PHASE_TIMEOUT_MS = 15_000;

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type NowLike = () => number;

export function calculateMbps(bytes: number, durationMs: number): number {
  if (!Number.isFinite(bytes) || !Number.isFinite(durationMs) || bytes <= 0 || durationMs <= 0) {
    return 0;
  }
  const bits = bytes * 8;
  const seconds = durationMs / 1000;
  const mbps = bits / seconds / 1_000_000;
  return Number(mbps.toFixed(2));
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  const lower = sorted[mid - 1] ?? 0;
  const upper = sorted[mid] ?? 0;
  return (lower + upper) / 2;
}

export function computeJitterMs(samples: number[]): number {
  if (samples.length < 2) return 0;
  let diffSum = 0;
  for (let i = 1; i < samples.length; i += 1) {
    diffSum += Math.abs((samples[i] ?? 0) - (samples[i - 1] ?? 0));
  }
  return Number((diffSum / (samples.length - 1)).toFixed(1));
}

function getEffectiveOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

export function isSaveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: FetchLike,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new Error('Speed test timed out waiting for Cloudflare endpoint.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function measureLatencyPing(options?: {
  samples?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  nowImpl?: NowLike;
  signal?: AbortSignal;
}): Promise<{ pingMs: number; jitterMs: number }> {
  const samplesCount = options?.samples ?? DEFAULT_PING_SAMPLES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_PHASE_TIMEOUT_MS;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const nowImpl = options?.nowImpl ?? (() => performance.now());

  const rtts: number[] = [];
  for (let i = 0; i < samplesCount; i += 1) {
    const start = nowImpl();
    const res = await fetchWithTimeout(
      `${CLOUDFLARE_DOWNLOAD_ENDPOINT}?bytes=0&t=${Date.now()}-${i}`,
      { method: 'GET', cache: 'no-store' },
      timeoutMs,
      fetchImpl,
      options?.signal,
    );
    if (!res.ok) {
      throw new Error(`Ping probe failed with HTTP ${res.status}.`);
    }
    if (res.body) {
      await res.arrayBuffer();
    }
    const elapsed = Math.max(0.1, nowImpl() - start);
    rtts.push(elapsed);
  }

  return {
    pingMs: Math.round(computeMedian(rtts)),
    jitterMs: computeJitterMs(rtts),
  };
}

export async function measureDownloadSpeed(options: {
  bytes: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  nowImpl?: NowLike;
  signal?: AbortSignal;
}): Promise<{ downloadMbps: number; actualBytes: number }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PHASE_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowImpl = options.nowImpl ?? (() => performance.now());

  const start = nowImpl();
  const res = await fetchWithTimeout(
    `${CLOUDFLARE_DOWNLOAD_ENDPOINT}?bytes=${options.bytes}&t=${Date.now()}`,
    { method: 'GET', cache: 'no-store' },
    timeoutMs,
    fetchImpl,
    options.signal,
  );
  if (!res.ok) {
    throw new Error(`Download probe failed with HTTP ${res.status}.`);
  }

  let actualBytes = 0;
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        actualBytes += chunk.value?.byteLength ?? 0;
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const buf = await res.arrayBuffer();
    actualBytes = buf.byteLength;
  }

  const elapsedMs = Math.max(1, nowImpl() - start);
  const measuredBytes = actualBytes > 0 ? actualBytes : options.bytes;

  return {
    downloadMbps: calculateMbps(measuredBytes, elapsedMs),
    actualBytes: measuredBytes,
  };
}

export async function measureUploadSpeed(options: {
  bytes: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  nowImpl?: NowLike;
  signal?: AbortSignal;
}): Promise<{ uploadMbps: number; actualBytes: number }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PHASE_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowImpl = options.nowImpl ?? (() => performance.now());

  // Non-PII synthetic binary payload (bounded, zero user data)
  const payload = new Uint8Array(options.bytes);
  payload.fill(0x5a);

  const start = nowImpl();
  const res = await fetchWithTimeout(
    CLOUDFLARE_UPLOAD_ENDPOINT,
    {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: payload,
    },
    timeoutMs,
    fetchImpl,
    options.signal,
  );
  if (!res.ok) {
    throw new Error(`Upload probe failed with HTTP ${res.status}.`);
  }

  const elapsedMs = Math.max(1, nowImpl() - start);
  return {
    uploadMbps: calculateMbps(options.bytes, elapsedMs),
    actualBytes: options.bytes,
  };
}

export type SpeedExecutionResult =
  | {
      ok: true;
      measurement: SpeedMeasurement;
    }
  | {
      ok: false;
      status: 'offline' | 'failed';
      errorMessage: string;
    };

export async function executeBoundedSpeedTest(options: {
  source: 'manual' | 'alarm';
  downloadProbeBytes: number;
  uploadProbeBytes: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  nowImpl?: NowLike;
  signal?: AbortSignal;
  onPhaseChange?: (phase: SpeedTestPhase) => void;
}): Promise<SpeedExecutionResult> {
  if (!getEffectiveOnlineStatus()) {
    return {
      ok: false,
      status: 'offline',
      errorMessage: 'No internet connection detected.',
    };
  }

  try {
    options.onPhaseChange?.('ping');
    const pingResult = await measureLatencyPing({
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      nowImpl: options.nowImpl,
      signal: options.signal,
    });

    options.onPhaseChange?.('download');
    const downloadResult = await measureDownloadSpeed({
      bytes: options.downloadProbeBytes,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      nowImpl: options.nowImpl,
      signal: options.signal,
    });

    options.onPhaseChange?.('upload');
    const uploadResult = await measureUploadSpeed({
      bytes: options.uploadProbeBytes,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      nowImpl: options.nowImpl,
      signal: options.signal,
    });

    options.onPhaseChange?.('complete');

    return {
      ok: true,
      measurement: {
        downloadMbps: downloadResult.downloadMbps,
        uploadMbps: uploadResult.uploadMbps,
        pingMs: pingResult.pingMs,
        jitterMs: pingResult.jitterMs,
        measuredAt: new Date().toISOString(),
        source: options.source,
        downloadBytes: downloadResult.actualBytes,
        uploadBytes: uploadResult.actualBytes,
      },
    };
  } catch (error) {
    if (!getEffectiveOnlineStatus()) {
      return {
        ok: false,
        status: 'offline',
        errorMessage: 'Connection went offline during measurement.',
      };
    }
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to reach Cloudflare speed test endpoint.';
    return {
      ok: false,
      status: 'failed',
      errorMessage: message,
    };
  }
}
