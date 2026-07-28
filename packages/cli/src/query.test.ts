import { describe, expect, it } from 'vitest';
import { buildQueryPath, parseEnvironment } from './query.js';

describe('buildQueryPath', () => {
  it('returns the path unchanged when query is empty', () => {
    expect(buildQueryPath('/v1/dashboard/apps', {})).toBe('/v1/dashboard/apps');
  });

  it('appends encoded query params and skips undefined', () => {
    expect(
      buildQueryPath('/v1/dashboard/apps/app_1/analytics', {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-07T00:00:00.000Z',
        environment: 'live',
        versionId: undefined,
      }),
    ).toBe(
      '/v1/dashboard/apps/app_1/analytics?startDate=2026-01-01T00%3A00%3A00.000Z&endDate=2026-01-07T00%3A00%3A00.000Z&environment=live',
    );
  });
});

describe('parseEnvironment', () => {
  it('defaults to live', () => {
    expect(parseEnvironment(undefined)).toBe('live');
  });

  it('rejects invalid values', () => {
    expect(() => parseEnvironment('staging')).toThrow(/test or live/);
  });
});
