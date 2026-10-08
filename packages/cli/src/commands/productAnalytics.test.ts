import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parseArgv, runCli } from '../cli.js';
import type { HttpClient, QueryParams } from '../http.js';
import { PRODUCT_ANALYTICS_VIEWS, planProductAnalyticsRequest, runProductAnalyticsCommand } from './productAnalytics.js';

const routeSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../apps/api/src/routes/dashboard/productAnalytics.ts',
  ),
  'utf8',
);

const routes = [
  ...routeSource.matchAll(/'(\/apps\/:appId\/product-analytics[^']*)'/g),
].map((match) => match[1]!);

const flagsFor = (path: string): Record<string, string | string[]> => {
  if (path.endsWith('/recent')) return { name: 'signup' };
  if (path.includes('/attribution')) return { dimension: 'campaign', grain: 'week' };
  if (path.includes('/technology')) return { dimension: 'devices', grain: 'week' };
  if (path.includes('/demographic')) return { dimension: 'city', grain: 'week' };
  if (path.includes('/engagement')) return { dimension: 'entry', grain: 'week' };
  if (path.includes('/retention/series') || path.includes('/retention/cohorts')) {
    return { dimension: 'country', value: 'US', grain: 'month' };
  }
  if (path.includes('series')) return { grain: 'month' };
  return {};
};

describe('planProductAnalyticsRequest', () => {
  it('covers every product analytics route', () => {
    expect(routes.length).toBe(PRODUCT_ANALYTICS_VIEWS.length);
    const seen = new Set<string>();
    for (const path of routes) {
      const view = path.replace('/apps/:appId/product-analytics/', '').replace(/\//g, '-');
      const plan = planProductAnalyticsRequest([view, 'app_1'], flagsFor(path));
      expect(plan, path).not.toBeNull();
      expect(plan!.path).toBe(`/v1/dashboard${path.replace(':appId', 'app_1')}`);
      expect(plan!.query.environment).toBe('live');
      if (path.endsWith('/live')) {
        expect(plan!.query.startDate).toBeUndefined();
      } else {
        expect(plan!.query.startDate).toEqual(expect.any(String));
        expect(plan!.query.endDate).toEqual(expect.any(String));
      }
      seen.add(view);
    }
    expect([...seen].sort()).toEqual([...PRODUCT_ANALYTICS_VIEWS].sort());
  });

  it('forwards platform, segment, grain, local filters, and repeated cross filters', () => {
    const plan = planProductAnalyticsRequest(['technology-series', 'app_1'], {
      env: 'test',
      platform: 'mobile',
      'segment-id': '11111111-1111-1111-1111-111111111111',
      grain: 'week',
      dimension: 'browsers',
      browsers: 'Chrome',
      'operating-systems': 'iOS',
      'xf-source': ['facebook', 'google'],
      'xf-device': ['iPhone'],
      start: '2026-09-01T00:00:00.000Z',
      end: '2026-09-08T00:00:00.000Z',
    });
    expect(plan?.path).toBe('/v1/dashboard/apps/app_1/product-analytics/technology-series');
    expect(plan?.query).toMatchObject({
      environment: 'test',
      platform: 'mobile',
      segmentId: '11111111-1111-1111-1111-111111111111',
      grain: 'week',
      dimension: 'browsers',
      browsers: 'Chrome',
      operatingSystems: 'iOS',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-08T00:00:00.000Z',
      xf_source: ['facebook', 'google'],
      xf_device: ['iPhone'],
    });
  });

  it('sends a page operator with the page values', () => {
    const plan = planProductAnalyticsRequest(['events', 'app_1'], {
      'xf-op-page': 'contains',
      'xf-page': ['/blog', '/docs'],
    });
    expect(plan?.query).toMatchObject({
      xf_op_page: 'contains',
      xf_page: ['/blog', '/docs'],
    });
  });

  it('accepts operator and entry flags', () => {
    const parsed = parseArgv([
      'analytics',
      'product',
      'events',
      'app_1',
      '--xf-op-page',
      'contains',
      '--xf-page',
      '/blog',
      '--xf-entry',
      '/pricing',
      '--xf-acquisition-channel',
      'Organic',
    ]);
    expect(parsed.flags['xf-op-page']).toBe('contains');
    expect(parsed.flags['xf-page']).toEqual(['/blog']);
    expect(parsed.flags['xf-entry']).toEqual(['/pricing']);
    expect(parsed.flags['xf-acquisition-channel']).toEqual(['Organic']);
  });

  it('rejects contains on a country filter', () => {
    expect(() =>
      planProductAnalyticsRequest(['events', 'app_1'], {
        'xf-op-country': 'contains',
        'xf-country': ['US'],
      }),
    ).toThrow(/cannot be contains/);
  });

  it('requires a dimension for breakdown views', () => {
    expect(() => planProductAnalyticsRequest(['attribution', 'app_1'], {})).toThrow(/dimension/);
    expect(() =>
      planProductAnalyticsRequest(['demographic', 'app_1'], { dimension: 'source' }),
    ).toThrow(/country, region, city/);
  });

  it('requires dimension and value together on retention drills', () => {
    expect(() =>
      planProductAnalyticsRequest(['retention-series', 'app_1'], { dimension: 'source' }),
    ).toThrow(/together/);
    const plan = planProductAnalyticsRequest(['retention-cohorts', 'app_1'], {});
    expect(plan?.query.dimension).toBeUndefined();
    expect(plan?.query.value).toBeUndefined();
  });

  it('requires an event name for recent rows', () => {
    expect(() => planProductAnalyticsRequest(['recent', 'app_1'], {})).toThrow(/--name/);
  });

  it('returns null for an unknown view', () => {
    expect(planProductAnalyticsRequest(['nope', 'app_1'], {})).toBeNull();
  });
});

describe('product analytics argv', () => {
  it('collects repeated and comma-separated cross filters', () => {
    const parsed = parseArgv([
      'analytics',
      'product',
      'events',
      'app_1',
      '--xf-source',
      'facebook,google',
      '--xf-source',
      'newsletter',
      '--xf-page',
      '/pricing',
      '--platform',
      'web',
      '--segment-id',
      'seg_1',
    ]);
    expect(parsed.command).toEqual(['analytics', 'product', 'events', 'app_1']);
    expect(parsed.flags['xf-source']).toEqual(['facebook', 'google', 'newsletter']);
    expect(parsed.flags['xf-page']).toEqual(['/pricing']);
    expect(parsed.flags.platform).toBe('web');
    expect(parsed.flags['segment-id']).toBe('seg_1');
  });
});

const fakeHttp = (): HttpClient & { calls: Array<{ path: string; query?: QueryParams }> } => {
  const calls: Array<{ path: string; query?: QueryParams }> = [];
  return {
    calls,
    get: async (path, query) => {
      calls.push({ path, query });
      return { visitors: 3 };
    },
    getText: async () => '',
    post: async () => null,
    patch: async () => null,
    put: async () => null,
    delete: async () => null,
    stream: async () => undefined,
  };
};

describe('runProductAnalyticsCommand', () => {
  it('prints the JSON response', async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const http = fakeHttp();
    const code = await runProductAnalyticsCommand({
      http,
      args: ['summary', 'app_1'],
      flags: { env: 'test', platform: 'web' },
    });
    expect(code).toBe(0);
    expect(http.calls[0]?.path).toBe('/v1/dashboard/apps/app_1/product-analytics/summary');
    expect(http.calls[0]?.query).toMatchObject({ environment: 'test', platform: 'web' });
    expect(lines.join('')).toContain('"visitors": 3');
    vi.restoreAllMocks();
  });

  it('rejects an unknown view', async () => {
    const err: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });
    const code = await runProductAnalyticsCommand({
      http: fakeHttp(),
      args: ['nope', 'app_1'],
      flags: {},
    });
    expect(code).toBe(1);
    expect(err.join('')).toContain('Unknown product analytics view');
    vi.restoreAllMocks();
  });
});

describe('runCli product help', () => {
  it('prints product analytics usage without a saved key', async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const code = await runCli(['analytics', 'product', 'help']);
    expect(code).toBe(0);
    expect(lines.join('')).toContain('rheo analytics product live');
    expect(lines.join('')).toContain('retention-cohorts');
    vi.restoreAllMocks();
  });
});
