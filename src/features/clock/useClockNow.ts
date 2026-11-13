import { useEffect, useMemo, useState } from 'react';

interface ClockListenerEntry {
  needsSeconds: boolean;
  listener: (nowMs: number) => void;
}

const entries = new Set<ClockListenerEntry>();
let activeTimeoutId: number | null = null;
let currentModeSeconds = false;

function scheduleTick(): void {
  if (activeTimeoutId !== null) {
    window.clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }
  if (entries.size === 0) return;

  const anyNeedsSeconds = Array.from(entries).some((entry) => entry.needsSeconds);
  currentModeSeconds = anyNeedsSeconds;
  const intervalMs = anyNeedsSeconds ? 1000 : 60_000;
  const now = Date.now();
  const delayMs = Math.max(16, intervalMs - (now % intervalMs));

  activeTimeoutId = window.setTimeout(() => {
    const tickNow = Date.now();
    for (const entry of entries) {
      entry.listener(tickNow);
    }
    scheduleTick();
  }, delayMs);
}

function ensureSchedulerMode(): void {
  if (entries.size === 0) {
    if (activeTimeoutId !== null) {
      window.clearTimeout(activeTimeoutId);
      activeTimeoutId = null;
    }
    return;
  }
  const anyNeedsSeconds = Array.from(entries).some((entry) => entry.needsSeconds);
  if (activeTimeoutId === null || anyNeedsSeconds !== currentModeSeconds) {
    scheduleTick();
  }
}

/**
 * Shared wall-clock time subscription aligned to exact second or minute boundaries.
 * Multiple clock widgets share a single global timer and never re-render sibling widgets.
 */
export function useClockNow(needsSeconds: boolean): Date {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const entry: ClockListenerEntry = {
      needsSeconds,
      listener: (nextNowMs) => setNowMs(nextNowMs),
    };
    entries.add(entry);
    ensureSchedulerMode();

    return () => {
      entries.delete(entry);
      ensureSchedulerMode();
    };
  }, [needsSeconds]);

  return useMemo(() => new Date(nowMs), [nowMs]);
}
