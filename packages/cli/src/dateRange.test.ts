import { describe, expect, it } from 'vitest';
import { DEFAULT_RANGE_DAYS, resolveDateRange } from './dateRange.js';
import { buildQueryPath, parseEnvironment } from './query.js';
import { isFlowAnalyticsKind } from './commands/analytics.js';

describe('resolveDateRange', () => {
  it('defaults to last 7 UTC days ending at now', () => {
    const now = new Date('2026-07-19T15:30:00.000Z');
    const range = resolveDateRange({ now });
    expect(DEFAULT_RANGE_DAYS).toBe(7);
    expect(range.startDate).toBe('2026-07-13T00:00:00.000Z');
    expect(range.endDate).toBe(now.toISOString());
  });

  it('accepts explicit start and end', () => {
    const range = resolveDateRange({
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-08T00:00:00.000Z',
    });
    expect(range.startDate).toBe('2026-01-01T00:00:00.000Z');
    expect(range.endDate).toBe('2026-01-08T00:00:00.000Z');
  });

  it('rejects only one bound', () => {
    expect(() => resolveDateRange({ start: '2026-01-01T00:00:00.000Z' })).toThrow(/both/);
  });
});

describe('query helpers', () => {
  it('buildQueryPath omits empty values', () => {
    expect(
      buildQueryPath('/v1/dashboard/x', {
        a: '1',
        b: undefined,
        c: '',
        d: false,
      }),
    ).toBe('/v1/dashboard/x?a=1&d=false');
  });

  it('parseEnvironment defaults to live', () => {
    expect(parseEnvironment(undefined)).toBe('live');
    expect(parseEnvironment('test')).toBe('test');
    expect(() => parseEnvironment('prod')).toThrow(/test or live/);
  });
});

describe('analytics kinds', () => {
  it('recognizes known kinds', () => {
    expect(isFlowAnalyticsKind('funnel')).toBe(true);
    expect(isFlowAnalyticsKind('nope')).toBe(false);
  });
});
