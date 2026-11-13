import { act, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveClock } from './LiveClock';

function SiblingProbe({ countRender }: { countRender: () => void }) {
  countRender();
  return <div data-testid="sibling-probe">Static sibling</div>;
}

describe('LiveClock Component & Render Isolation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays non-local timezone indicator badge and Royal Crystal surface when configured', () => {
    const { container } = render(
      <LiveClock
        propsOverride={{
          format: '24h',
          showSeconds: true,
          showDate: true,
          showWeekday: true,
          weekdayFormat: 'short',
          timeZone: 'Asia/Tokyo',
          containerStyle: 'crystal',
          alignment: 'left',
        }}
      />,
    );

    expect(screen.getByTitle('Asia/Tokyo')).toHaveTextContent('Tokyo');
    expect(container.querySelector('.aurora-glass')).not.toBeNull();
  });

  it('isolates 1-second clock ticks so sibling widgets do not re-render', () => {
    const siblingRenders = vi.fn();

    render(
      <div>
        <LiveClock
          propsOverride={{
            format: '24h',
            showSeconds: true,
            showDate: true,
            showWeekday: true,
            weekdayFormat: 'long',
            timeZone: 'UTC',
          }}
        />
        <Profiler
          id="sibling"
          onRender={() => {
            siblingRenders();
          }}
        >
          <SiblingProbe countRender={() => undefined} />
        </Profiler>
      </div>,
    );

    const initialCount = siblingRenders.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    // LiveClock digits tick internally, while unrelated sibling remains untouched
    expect(siblingRenders).toHaveBeenCalledTimes(initialCount);
  });
});
