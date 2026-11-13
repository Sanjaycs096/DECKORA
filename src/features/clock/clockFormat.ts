import type { ClockElementProps } from '@/types/workspace';

export interface CuratedTimeZoneOption {
  value: string;
  label: string;
  region: string;
}

export const CURATED_TIMEZONES: CuratedTimeZoneOption[] = [
  { value: 'local', label: 'System Local Time', region: 'Automatic' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', region: 'Global' },
  { value: 'America/New_York', label: 'New York (Eastern)', region: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago (Central)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific)', region: 'Americas' },
  { value: 'Europe/London', label: 'London (GMT / BST)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (CET / CEST)', region: 'Europe' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'India / Kolkata (IST)', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', region: 'Pacific' },
];

export interface FormattedClockDisplay {
  timeString: string;
  period: 'AM' | 'PM' | null;
  dateString: string;
  weekdayString: string | null;
  resolvedTimeZone: string;
  isFallbackLocal: boolean;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function validateTimeZone(rawTimeZone: string): {
  valid: boolean;
  ianaZone: string | undefined;
  displayLabel: string;
} {
  const trimmed = rawTimeZone.trim();
  if (!trimmed || trimmed === 'local') {
    return { valid: true, ianaZone: undefined, displayLabel: 'Local' };
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    const shortCity = trimmed.includes('/')
      ? (trimmed.split('/').pop()?.replaceAll('_', ' ') ?? trimmed)
      : trimmed;
    return { valid: true, ianaZone: trimmed, displayLabel: shortCity };
  } catch {
    return { valid: false, ianaZone: undefined, displayLabel: 'Local (fallback)' };
  }
}

export function formatClockDisplay(
  date: Date,
  options: Pick<
    ClockElementProps,
    'format' | 'showSeconds' | 'showDate' | 'showWeekday' | 'weekdayFormat' | 'timeZone'
  >,
): FormattedClockDisplay {
  const tzInfo = validateTimeZone(options.timeZone);
  const tz = tzInfo.ianaZone;

  const timePartsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = timePartsFormatter.formatToParts(date);
  const rawHour = Number(parts.find((p) => p.type === 'hour')?.value ?? date.getHours());
  const normalizedHour24 = rawHour === 24 ? 0 : rawHour;
  const minute = parts.find((p) => p.type === 'minute')?.value ?? pad2(date.getMinutes());
  const second = parts.find((p) => p.type === 'second')?.value ?? pad2(date.getSeconds());

  let displayHour = pad2(normalizedHour24);
  let period: 'AM' | 'PM' | null = null;

  if (options.format === '12h') {
    period = normalizedHour24 >= 12 ? 'PM' : 'AM';
    const hour12 = normalizedHour24 % 12 === 0 ? 12 : normalizedHour24 % 12;
    displayHour = pad2(hour12);
  }

  const timeString = options.showSeconds
    ? `${displayHour}:${minute}:${second}`
    : `${displayHour}:${minute}`;

  let dateString = '';
  if (options.showDate) {
    const dateFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    dateString = dateFormatter.format(date);
  }

  let weekdayString: string | null = null;
  if (options.showWeekday) {
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: options.weekdayFormat,
    });
    weekdayString = weekdayFormatter.format(date);
  }

  return {
    timeString,
    period,
    dateString,
    weekdayString,
    resolvedTimeZone: tzInfo.displayLabel,
    isFallbackLocal: !tzInfo.valid,
  };
}
