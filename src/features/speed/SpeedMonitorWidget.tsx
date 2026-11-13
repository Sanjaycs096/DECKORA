import { useEffect, useMemo, useState } from 'react';
import { MaterialSymbol } from '@/components/shared/MaterialSymbol';
import { Button, IconButton } from '@/components/ui';
import { getCssBorderStyle, getElementBoxShadowCss } from '@/features/elements/elementStyleUtils';
import { parseSpeedProps } from '@/services/storage/schemas';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type {
  GenericCanvasElement,
  SpeedCacheState,
  SpeedElementProps,
  SpeedTestPhase,
} from '@/types/workspace';
import { markSpeedPermissionRevoked, runAndPersistSpeedTest } from './speedCoordinator';
import {
  checkSpeedTestPermission,
  requestSpeedTestPermission,
  type SpeedPermissionState,
} from './speedPermissions';

export interface SpeedMonitorWidgetProps {
  element: GenericCanvasElement;
  editPreview?: boolean;
}

function formatMbps(value: number | null | undefined, precision: 1 | 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(precision);
}

function formatMeasuredTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Not tested yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not tested yet';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function phaseLabel(phase: SpeedTestPhase): string {
  switch (phase) {
    case 'ping':
      return 'Measuring latency...';
    case 'download':
      return 'Testing download...';
    case 'upload':
      return 'Testing upload...';
    default:
      return 'Running speed test...';
  }
}

export function SpeedMonitorWidget({ element, editPreview = false }: SpeedMonitorWidgetProps) {
  const speedCache = useWorkspaceStore((s) => s.workspace.speedCache);
  const setSpeedCache = useWorkspaceStore((s) => s.setSpeedCache);

  const props: SpeedElementProps = useMemo(() => parseSpeedProps(element.props), [element.props]);

  const [permissionState, setPermissionState] = useState<SpeedPermissionState>('unavailable');
  const [livePhase, setLivePhase] = useState<SpeedTestPhase | null>(null);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (editPreview) return undefined;
    let cancelled = false;
    void checkSpeedTestPermission().then((result) => {
      if (!cancelled) {
        setPermissionState(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editPreview]);

  const effectiveStatus: SpeedCacheState['status'] = (() => {
    if (livePhase && livePhase !== 'complete' && livePhase !== 'idle') {
      return 'testing';
    }
    if (permissionState === 'denied') {
      return 'permission-required';
    }
    return speedCache?.status ?? 'idle';
  })();

  const isRunning = effectiveStatus === 'testing' || Boolean(speedCache?.isRunning);
  const lastResult = speedCache?.lastSuccessfulResult ?? null;

  const executeTest = async () => {
    if (editPreview || isRunning) return;
    setPermissionNotice(null);
    setLivePhase('ping');
    try {
      const updated = await runAndPersistSpeedTest({
        source: 'manual',
        downloadProbeBytes: props.downloadProbeBytes,
        uploadProbeBytes: props.uploadProbeBytes,
        onPhaseChange: (phase) => setLivePhase(phase),
        onCacheUpdated: (nextCache) => setSpeedCache(nextCache),
      });
      setSpeedCache(updated);
      if (updated.status === 'permission-required') {
        setPermissionState('denied');
      }
    } finally {
      setLivePhase(null);
    }
  };

  const handleEnablePermission = async () => {
    if (editPreview || isRunning) return;
    setPermissionNotice(null);
    const res = await requestSpeedTestPermission();
    if (!res.granted) {
      if (res.unavailable) {
        // Fallback preview environments outside Chrome extension runtime can still test fetch directly
        setPermissionState('unavailable');
        await executeTest();
      } else {
        setPermissionState('denied');
        setPermissionNotice(
          res.reason ?? 'Optional permission declined. Enable anytime to measure speeds.',
        );
        const revoked = await markSpeedPermissionRevoked();
        setSpeedCache(revoked);
      }
      return;
    }

    setPermissionState('granted');
    await executeTest();
  };

  const isCompact = props.layoutMode === 'compact';
  const showPermissionPrompt = !editPreview && effectiveStatus === 'permission-required';

  const borderStyleObj = getCssBorderStyle(element.style);
  const boxShadowCss = getElementBoxShadowCss(element.style.shadow);
  const containerStyle: React.CSSProperties = {
    ...(element.style.borderStyle !== 'none' && element.style.borderWidthPx > 0
      ? borderStyleObj
      : {}),
    borderRadius: `${Math.min(40, element.style.cornerRadiusPx)}px`,
    ...(boxShadowCss ? { boxShadow: boxShadowCss } : {}),
  };

  const metricsVisibleCount =
    Number(props.showDownload) + Number(props.showUpload) + Number(props.showPing);

  return (
    <section
      aria-label="Internet Speed Monitor"
      style={containerStyle}
      className={`aurora-glass flex h-full w-full flex-col justify-between overflow-hidden ${
        isCompact ? 'gap-2 p-3' : 'gap-3 p-4'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <MaterialSymbol
            name={effectiveStatus === 'offline' ? 'wifi_off' : 'speed'}
            size={18}
            className={
              effectiveStatus === 'offline' || effectiveStatus === 'failed'
                ? 'text-[var(--aurora-warning)]'
                : 'text-[var(--aurora-primary)]'
            }
          />
          <h2 className="truncate font-[var(--font-display)] text-xs font-semibold tracking-wide text-[var(--aurora-text)]">
            {props.title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {props.autoMeasureIntervalMinutes > 0 && (
            <span
              title={`Scheduled every ${props.autoMeasureIntervalMinutes} minutes while Chrome is open`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/70 px-2 py-0.5 text-[10px] font-medium text-[var(--aurora-text-secondary)]"
            >
              <MaterialSymbol name="schedule" size={11} />
              <span>{props.autoMeasureIntervalMinutes}m</span>
            </span>
          )}

          {props.showManualButton && !showPermissionPrompt && (
            <IconButton
              icon={isRunning ? 'sync' : 'refresh'}
              label={isRunning ? 'Speed test running' : 'Run speed test'}
              size="sm"
              iconSize={16}
              disabled={editPreview || isRunning}
              onClick={() => {
                void executeTest();
              }}
              className={`h-7 w-7 rounded-full ${isRunning ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      {showPermissionPrompt ? (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <div className="flex items-start gap-2 text-xs text-[var(--aurora-text-secondary)]">
            <MaterialSymbol
              name="verified_user"
              size={16}
              className="mt-0.5 shrink-0 text-[var(--aurora-primary)]"
            />
            <p className="leading-snug">
              Optional access to{' '}
              <span className="font-mono text-[11px] text-[var(--aurora-text)]">
                speed.cloudflare.com
              </span>{' '}
              lets Deckora measure real Download, Upload &amp; Ping.
            </p>
          </div>
          {permissionNotice && (
            <p role="status" className="text-[11px] text-[var(--aurora-warning)]">
              {permissionNotice}
            </p>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              void handleEnablePermission();
            }}
            className="w-full"
          >
            <MaterialSymbol name="verified_user" size={15} />
            <span>Enable Speed Test</span>
          </Button>
          {lastResult && (
            <p className="text-[10px] text-[var(--aurora-text-muted)]">
              Last recorded: ↓ {formatMbps(lastResult.downloadMbps, props.precision)} Mbps • ↑{' '}
              {formatMbps(lastResult.uploadMbps, props.precision)} Mbps • {lastResult.pingMs} ms
            </p>
          )}
        </div>
      ) : (
        <>
          {metricsVisibleCount > 0 ? (
            <div
              className={`grid gap-2 ${
                metricsVisibleCount === 1
                  ? 'grid-cols-1'
                  : metricsVisibleCount === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-3'
              }`}
            >
              {props.showDownload && (
                <div className="rounded-xl border border-[var(--aurora-border)]/70 bg-[var(--aurora-surface)]/45 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--aurora-text-secondary)]">
                    <MaterialSymbol
                      name="download"
                      size={13}
                      className="text-[var(--aurora-primary)]"
                    />
                    <span>Down</span>
                  </div>
                  <p
                    className={`mt-0.5 font-[var(--font-display)] font-semibold tabular-nums text-[var(--aurora-text)] ${
                      isCompact ? 'text-sm' : 'text-lg'
                    }`}
                  >
                    {formatMbps(lastResult?.downloadMbps, props.precision)}
                    <span className="ml-1 text-[10px] font-normal text-[var(--aurora-text-muted)]">
                      Mbps
                    </span>
                  </p>
                </div>
              )}

              {props.showUpload && (
                <div className="rounded-xl border border-[var(--aurora-border)]/70 bg-[var(--aurora-surface)]/45 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--aurora-text-secondary)]">
                    <MaterialSymbol
                      name="upload"
                      size={13}
                      className="text-[var(--aurora-secondary)]"
                    />
                    <span>Up</span>
                  </div>
                  <p
                    className={`mt-0.5 font-[var(--font-display)] font-semibold tabular-nums text-[var(--aurora-text)] ${
                      isCompact ? 'text-sm' : 'text-lg'
                    }`}
                  >
                    {formatMbps(lastResult?.uploadMbps, props.precision)}
                    <span className="ml-1 text-[10px] font-normal text-[var(--aurora-text-muted)]">
                      Mbps
                    </span>
                  </p>
                </div>
              )}

              {props.showPing && (
                <div className="rounded-xl border border-[var(--aurora-border)]/70 bg-[var(--aurora-surface)]/45 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--aurora-text-secondary)]">
                    <MaterialSymbol
                      name="network_ping"
                      size={13}
                      className="text-[var(--aurora-success)]"
                    />
                    <span>Ping</span>
                  </div>
                  <p
                    className={`mt-0.5 font-[var(--font-display)] font-semibold tabular-nums text-[var(--aurora-text)] ${
                      isCompact ? 'text-sm' : 'text-lg'
                    }`}
                  >
                    {lastResult ? lastResult.pingMs : '—'}
                    <span className="ml-1 text-[10px] font-normal text-[var(--aurora-text-muted)]">
                      ms
                    </span>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--aurora-text-muted)]">
              Enable Download, Upload, or Ping in Inspector.
            </p>
          )}

          {/* Status & Footer */}
          <div className="flex items-center justify-between gap-2 text-[11px]">
            {isRunning ? (
              <span
                role="status"
                className="flex items-center gap-1.5 font-medium text-[var(--aurora-primary)]"
              >
                <MaterialSymbol name="speed" size={14} />
                <span>{phaseLabel(livePhase ?? speedCache?.phase ?? 'ping')}</span>
              </span>
            ) : effectiveStatus === 'offline' ? (
              <span
                role="status"
                className="flex items-center gap-1 truncate font-medium text-[var(--aurora-warning)]"
                title={speedCache?.errorMessage ?? 'Offline'}
              >
                <MaterialSymbol name="wifi_off" size={14} />
                <span className="truncate">
                  {lastResult ? 'Offline • Showing last result' : 'Offline — check connection'}
                </span>
              </span>
            ) : effectiveStatus === 'failed' ? (
              <span
                role="status"
                className="flex items-center gap-1 truncate font-medium text-[var(--aurora-error)]"
                title={speedCache?.errorMessage ?? 'Speed test failed'}
              >
                <MaterialSymbol name="error_outline" size={14} />
                <span className="truncate">
                  {lastResult
                    ? `Failed • Last: ${formatMeasuredTimestamp(lastResult.measuredAt)}`
                    : (speedCache?.errorMessage ?? 'Test failed')}
                </span>
              </span>
            ) : props.showLastTested ? (
              <span className="truncate text-[var(--aurora-text-secondary)]">
                {lastResult
                  ? `${lastResult.source === 'alarm' ? 'Auto' : 'Manual'} • ${formatMeasuredTimestamp(lastResult.measuredAt)}`
                  : editPreview
                    ? 'Edit Mode Preview'
                    : 'Not tested yet'}
              </span>
            ) : (
              <span />
            )}

            {props.showManualButton && !lastResult && !isRunning && (
              <Button
                type="button"
                variant="glass"
                size="sm"
                disabled={editPreview}
                onClick={() => {
                  void executeTest();
                }}
                className="h-7 shrink-0 px-2.5 text-[11px]"
              >
                Run Test
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
