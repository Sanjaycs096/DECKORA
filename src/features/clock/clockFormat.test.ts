import { describe, expect, it } from 'vitest';
import { formatClockDisplay, validateTimeZone } from './clockFormat';

describe('Clock & Date Formatting', () => {
  const sampleDate = new Date(2026, 10, 12, 14, 5, 9); // Thu Nov 12 2026 14:05:09 local
  const midnightDate = new Date(2026, 0, 3, 0, 4, 7); // Sat Jan 03 2026 00:04:07 local

  it('formats 24-hour time with seconds and DD/MM/YYYY date by default', () => {
    const res = formatClockDisplay(sampleDate, {
      format: '24h',
      showSeconds: true,
      showDate: true,
      showWeekday: true,
      weekdayFormat: 'long',
      timeZone: 'local',
    });

    expect(res.timeString).toBe('14:05:09');
    expect(res.period).toBeNull();
    expect(res.dateString).toBe('12/11/2026');
    expect(res.weekdayString).toBe('Thursday');
  });

  it('formats 12-hour time accurately including midnight and afternoon', () => {
    const afternoon = formatClockDisplay(sampleDate, {
      format: '12h',
      showSeconds: true,
      showDate: true,
      showWeekday: false,
      weekdayFormat: 'long',
      timeZone: 'local',
    });
    expect(afternoon.timeString).toBe('02:05:09');
    expect(afternoon.period).toBe('PM');
    expect(afternoon.weekdayString).toBeNull();

    const midnight = formatClockDisplay(midnightDate, {
      format: '12h',
      showSeconds: true,
      showDate: true,
      showWeekday: false,
      weekdayFormat: 'long',
      timeZone: 'local',
    });
    expect(midnight.timeString).toBe('12:04:07');
    expect(midnight.period).toBe('AM');
    expect(midnight.dateString).toBe('03/01/2026');
  });

  it('omits seconds when showSeconds is false', () => {
    const res = formatClockDisplay(sampleDate, {
      format: '24h',
      showSeconds: false,
      showDate: true,
      showWeekday: false,
      weekdayFormat: 'short',
      timeZone: 'local',
    });
    expect(res.timeString).toBe('14:05');
  });

  it('validates IANA timezones and falls back cleanly on invalid zones', () => {
    expect(validateTimeZone('local')).toEqual({
      valid: true,
      ianaZone: undefined,
      displayLabel: 'Local',
    });
    expect(validateTimeZone('America/New_York').valid).toBe(true);
    expect(validateTimeZone('Mars/Olympus_Mons').valid).toBe(false);

    const utcRes = formatClockDisplay(new Date('2026-11-12T10:15:30.000Z'), {
      format: '24h',
      showSeconds: true,
      showDate: true,
      showWeekday: true,
      weekdayFormat: 'short',
      timeZone: 'UTC',
    });
    expect(utcRes.timeString).toBe('10:15:30');
    expect(utcRes.isFallbackLocal).toBe(false);
    expect(utcRes.resolvedTimeZone).toBe('UTC');

    const badRes = formatClockDisplay(sampleDate, {
      format: '24h',
      showSeconds: false,
      showDate: true,
      showWeekday: false,
      weekdayFormat: 'short',
      timeZone: 'Invalid/Timezone',
    });
    expect(badRes.isFallbackLocal).toBe(true);
    expect(badRes.resolvedTimeZone).toBe('Local (fallback)');
  });
});
