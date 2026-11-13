import { memo, useMemo } from 'react';
import {
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
} from '@/components/ui';
import { DEFAULT_CLOCK_ELEMENT_ID } from '@/services/storage/defaults';
import { parseClockProps } from '@/services/storage/schemas';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type { ClockElementProps } from '@/types/workspace';
import { formatClockDisplay } from './clockFormat';
import { useClockNow } from './useClockNow';

export interface LiveClockProps {
  elementId?: string;
  propsOverride?: Record<string, unknown>;
  editPreview?: boolean;
}

interface ClockDigitsDisplayProps {
  clockProps: ClockElementProps;
}

const ALIGNMENT_CLASS_MAP: Record<ClockElementProps['alignment'], string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const ROW_JUSTIFY_CLASS_MAP: Record<ClockElementProps['alignment'], string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const ClockDigitsDisplay = memo(function ClockDigitsDisplay({
  clockProps,
}: ClockDigitsDisplayProps) {
  const now = useClockNow(clockProps.showSeconds);
  const formatted = useMemo(() => formatClockDisplay(now, clockProps), [now, clockProps]);

  const customColorStyle =
    clockProps.color && clockProps.color !== 'auto' ? clockProps.color : undefined;

  return (
    <>
      <div
        className={`relative flex items-baseline gap-2.5 ${ROW_JUSTIFY_CLASS_MAP[clockProps.alignment]}`}
      >
        <time
          dateTime={now.toISOString()}
          className="leading-none tracking-tight text-[var(--aurora-text)]"
          style={{
            fontFamily: clockProps.fontFamily || 'var(--font-display)',
            fontSize: `clamp(2rem, 8vw, ${clockProps.fontSizePx}px)`,
            fontWeight: clockProps.fontWeight,
            letterSpacing: `${clockProps.letterSpacingEm}em`,
            color: customColorStyle,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 4px 24px rgba(0, 0, 0, 0.22)',
          }}
        >
          {formatted.timeString}
        </time>

        {formatted.period && (
          <span
            className="font-[var(--font-display)] text-lg font-medium tracking-wide text-[var(--aurora-primary)] sm:text-2xl"
            style={customColorStyle ? { color: customColorStyle, opacity: 0.85 } : undefined}
          >
            {formatted.period}
          </span>
        )}
      </div>

      {(formatted.weekdayString || formatted.dateString || clockProps.timeZone !== 'local') && (
        <p
          className={`mt-2 flex flex-wrap items-center gap-2 text-sm font-medium tracking-wide text-[var(--aurora-text-secondary)] sm:text-base ${ROW_JUSTIFY_CLASS_MAP[clockProps.alignment]}`}
        >
          {formatted.weekdayString && <span>{formatted.weekdayString}</span>}
          {formatted.weekdayString && formatted.dateString && (
            <span aria-hidden="true" className="text-[var(--aurora-primary)]">
              •
            </span>
          )}
          {formatted.dateString && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatted.dateString}</span>
          )}
          {clockProps.timeZone !== 'local' && (
            <span
              className="rounded-full border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/70 px-2 py-0.5 text-[11px] font-medium text-[var(--aurora-text-secondary)]"
              title={
                formatted.isFallbackLocal
                  ? `Invalid timezone "${clockProps.timeZone}" — showing local time`
                  : clockProps.timeZone
              }
            >
              {formatted.resolvedTimeZone}
            </span>
          )}
        </p>
      )}
    </>
  );
});

export function LiveClock({
  elementId = DEFAULT_CLOCK_ELEMENT_ID,
  propsOverride,
  editPreview = false,
}: LiveClockProps = {}) {
  const storeClockProps = useWorkspaceStore(
    (s) => s.workspace.profiles[s.workspace.activeProfileId]?.layout.elements[elementId]?.props,
  );
  const rawClockProps = propsOverride ?? storeClockProps;
  const updateElementProps = useWorkspaceStore((s) => s.updateActiveProfileElementProps);

  const clockProps: ClockElementProps = useMemo(
    () => parseClockProps(rawClockProps),
    [rawClockProps],
  );

  const updateClockSetting = (patch: Partial<ClockElementProps>) => {
    void updateElementProps(elementId, patch);
  };

  const containerClasses =
    clockProps.containerStyle === 'crystal' ? 'aurora-glass rounded-2xl px-6 py-4' : 'px-2 py-1';

  return (
    <section
      aria-label="Clock and date"
      className={`group relative flex h-full w-full flex-col justify-center select-none ${ALIGNMENT_CLASS_MAP[clockProps.alignment]} ${containerClasses}`}
    >
      <ClockDigitsDisplay clockProps={clockProps} />

      {!editPreview && (
        <div className="absolute top-2 right-2 opacity-0 transition-opacity duration-[var(--aurora-duration-fast)] group-focus-within:opacity-100 group-hover:opacity-100">
          <Dropdown>
            <DropdownTrigger asChild>
              <IconButton
                icon="schedule"
                label="Clock display options"
                size="sm"
                variant="ghost"
                className="rounded-full"
              />
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownCheckboxItem
                checked={clockProps.format === '24h'}
                onCheckedChange={(checked) =>
                  updateClockSetting({ format: checked ? '24h' : '12h' })
                }
              >
                24-hour format
              </DropdownCheckboxItem>
              <DropdownCheckboxItem
                checked={clockProps.showSeconds}
                onCheckedChange={(checked) => updateClockSetting({ showSeconds: Boolean(checked) })}
              >
                Show seconds
              </DropdownCheckboxItem>
              <DropdownCheckboxItem
                checked={clockProps.showDate}
                onCheckedChange={(checked) => updateClockSetting({ showDate: Boolean(checked) })}
              >
                Show date (DD/MM/YYYY)
              </DropdownCheckboxItem>
              <DropdownSeparator />
              <DropdownCheckboxItem
                checked={clockProps.showWeekday}
                onCheckedChange={(checked) => updateClockSetting({ showWeekday: Boolean(checked) })}
              >
                Show weekday
              </DropdownCheckboxItem>
            </DropdownContent>
          </Dropdown>
        </div>
      )}
    </section>
  );
}
