import { resolveDateRange } from '../dateRange.js';
import { printJson } from '../format.js';
import type { HttpClient } from '../http.js';
import { flagString, flagStrings, parseEnvironment } from '../query.js';
import type { CliFlags, QueryParams } from '../query.js';

export const PRODUCT_ANALYTICS_VIEWS = [
  'live',
  'summary',
  'overview',
  'series',
  'attribution',
  'attribution-series',
  'technology',
  'technology-series',
  'events',
  'screens',
  'recent',
  'visitors',
  'demographic',
  'demographic-series',
  'engagement',
  'engagement-series',
  'events-series',
  'retention',
  'retention-series',
  'retention-cohorts',
  'retention-curve',
] as const;

export type ProductAnalyticsView = (typeof PRODUCT_ANALYTICS_VIEWS)[number];

type DimensionKind = 'attribution' | 'technology' | 'demographic' | 'engagement' | 'retention';

type ViewSpec = {
  path: string;
  dates: boolean;
  grain: boolean;
  dimension?: DimensionKind;
  /** Retention drills accept dimension and value together, or neither. */
  dimensionOptional?: boolean;
  name?: boolean;
  attribution?: boolean;
  technology?: boolean;
  demographic?: boolean;
  engagement?: boolean;
  cross?: boolean;
};

const DIMENSIONS: Record<DimensionKind, readonly string[]> = {
  attribution: [
    'acquisitionChannel',
    'referrer',
    'source',
    'campaign',
    'medium',
    'content',
    'term',
    'adset',
    'creative',
  ],
  technology: ['browsers', 'operatingSystems', 'devices'],
  demographic: ['country', 'region', 'city'],
  engagement: ['page', 'entry', 'exit'],
  retention: ['source', 'campaign', 'country', 'platform', 'device'],
};

const GRAINS = ['day', 'week', 'month'] as const;
const PLATFORMS = ['all', 'web', 'mobile'] as const;

const CROSS_FILTER_FLAGS: ReadonlyArray<readonly [string, string]> = [
  ['acquisition-channel', 'acquisitionChannel'],
  ['referrer', 'referrer'],
  ['source', 'source'],
  ['campaign', 'campaign'],
  ['medium', 'medium'],
  ['country', 'country'],
  ['region', 'region'],
  ['browser', 'browser'],
  ['os', 'os'],
  ['device', 'device'],
  ['page', 'page'],
  ['event', 'event'],
  ['entry', 'entry'],
  ['exit', 'exit'],
];

const TEXT_CROSS_DIMENSIONS = new Set(['campaign', 'page', 'event', 'entry', 'exit']);
const TRAFFIC_FILTER_OPS = ['is', 'is_not', 'contains', 'does_not_contain'] as const;

const VIEWS: Record<ProductAnalyticsView, ViewSpec> = {
  live: { path: '/live', dates: false, grain: false },
  summary: { path: '/summary', dates: true, grain: false },
  overview: { path: '/overview', dates: true, grain: false },
  series: { path: '/series', dates: true, grain: true, attribution: true, cross: true },
  attribution: {
    path: '/attribution',
    dates: true,
    grain: false,
    dimension: 'attribution',
    attribution: true,
    cross: true,
  },
  'attribution-series': {
    path: '/attribution-series',
    dates: true,
    grain: true,
    dimension: 'attribution',
    attribution: true,
    cross: true,
  },
  technology: {
    path: '/technology',
    dates: true,
    grain: false,
    dimension: 'technology',
    technology: true,
    cross: true,
  },
  'technology-series': {
    path: '/technology-series',
    dates: true,
    grain: true,
    dimension: 'technology',
    technology: true,
    cross: true,
  },
  events: { path: '/events', dates: true, grain: false, cross: true },
  screens: { path: '/screens', dates: true, grain: false },
  recent: { path: '/recent', dates: true, grain: false, name: true },
  visitors: { path: '/visitors', dates: true, grain: false },
  demographic: {
    path: '/demographic',
    dates: true,
    grain: false,
    dimension: 'demographic',
    demographic: true,
    cross: true,
  },
  'demographic-series': {
    path: '/demographic-series',
    dates: true,
    grain: true,
    dimension: 'demographic',
    demographic: true,
    cross: true,
  },
  engagement: {
    path: '/engagement',
    dates: true,
    grain: false,
    dimension: 'engagement',
    engagement: true,
    cross: true,
  },
  'engagement-series': {
    path: '/engagement-series',
    dates: true,
    grain: true,
    dimension: 'engagement',
    engagement: true,
    cross: true,
  },
  'events-series': { path: '/events-series', dates: true, grain: true, cross: true },
  retention: { path: '/retention', dates: true, grain: false },
  'retention-series': {
    path: '/retention/series',
    dates: true,
    grain: true,
    dimension: 'retention',
    dimensionOptional: true,
  },
  'retention-cohorts': {
    path: '/retention/cohorts',
    dates: true,
    grain: true,
    dimension: 'retention',
    dimensionOptional: true,
  },
  'retention-curve': { path: '/retention/curve', dates: true, grain: false },
};

export const PRODUCT_ANALYTICS_USAGE = `rheo analytics product: product analytics (dashboard API, analytics:read)

Default --env is live. Omit --start and --end for the last 7 UTC days.
Omit --platform for all (web and mobile). Omit --grain for day.
--segment-id limits results to one audience. Cross filters (--xf-*) repeat
or take commas; values in one dimension match with OR. One operator per
dimension: --xf-op-page contains. A missing operator means is. is and is not
apply to every dimension. contains and does not contain apply to campaign,
page, event, entry, and exit. Contains is case-sensitive.

  rheo analytics product live <appId> [--env] [--platform] [--segment-id]
  rheo analytics product summary|overview|screens|visitors <appId> [--env] [--platform] [--segment-id] [--start] [--end]
  rheo analytics product series <appId> [--grain] [--source] [--campaign] [--medium] [--content] [--term] [--adset] [--creative] [--xf-*]
  rheo analytics product attribution <appId> --dimension <acquisitionChannel|referrer|source|campaign|medium|content|term|adset|creative> [--source] [--campaign] …
  rheo analytics product attribution-series <appId> --dimension <dim> [--grain]
  rheo analytics product technology <appId> --dimension <browsers|operatingSystems|devices> [--browsers] [--operating-systems] [--devices]
  rheo analytics product technology-series <appId> --dimension <dim> [--grain]
  rheo analytics product demographic <appId> --dimension <country|region|city> [--country] [--region] [--city]
  rheo analytics product demographic-series <appId> --dimension <dim> [--grain]
  rheo analytics product engagement <appId> --dimension <page|entry|exit> [--page] [--entry] [--exit]
  rheo analytics product engagement-series <appId> --dimension <dim> [--grain]
  rheo analytics product events|events-series <appId> [--grain for events-series] [--xf-*]
  rheo analytics product recent <appId> --name <event>
  rheo analytics product retention|retention-curve <appId>
  rheo analytics product retention-series|retention-cohorts <appId> [--grain] [--dimension <source|campaign|country|platform|device> --value <value>]

Cross filters: --xf-acquisition-channel --xf-referrer --xf-source --xf-campaign --xf-medium
  --xf-country --xf-region --xf-browser --xf-os --xf-device --xf-page --xf-event
  --xf-entry --xf-exit
Operators: --xf-op-<dimension> is|is_not|contains|does_not_contain
Responses print JSON.
`;

const oneOf = (raw: string, allowed: readonly string[], flag: string): string => {
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new Error(`--${flag} must be ${allowed.join(', ')} (got ${raw})`);
  }
  return raw;
};

const assignSingle = (
  query: QueryParams,
  flags: CliFlags,
  pairs: ReadonlyArray<readonly [string, string]>,
): void => {
  for (const [flag, param] of pairs) {
    const value = flagString(flags, flag);
    if (value) query[param] = value;
  }
};

const assignCross = (query: QueryParams, flags: CliFlags): void => {
  for (const [flag, dimension] of CROSS_FILTER_FLAGS) {
    const values = flagStrings(flags, `xf-${flag}`);
    const op = flagString(flags, `xf-op-${flag}`);
    if (values.length > 0) query[`xf_${dimension}`] = values;
    if (!op || op === 'is') continue;
    if (values.length === 0) throw new Error(`--xf-op-${flag} requires --xf-${flag}`);
    if (!(TRAFFIC_FILTER_OPS as readonly string[]).includes(op)) {
      throw new Error(`--xf-op-${flag} must be ${TRAFFIC_FILTER_OPS.join(', ')}`);
    }
    if (
      (op === 'contains' || op === 'does_not_contain') &&
      !TEXT_CROSS_DIMENSIONS.has(dimension)
    ) {
      throw new Error(`--xf-op-${flag} cannot be ${op}`);
    }
    query[`xf_op_${dimension}`] = op;
  }
};

const applyDimension = (view: string, spec: ViewSpec, flags: CliFlags, query: QueryParams): void => {
  if (!spec.dimension) return;
  const dimension = flagString(flags, 'dimension');
  const value = flagString(flags, 'value');
  if (spec.dimensionOptional) {
    if (Boolean(dimension) !== Boolean(value)) {
      throw new Error('--dimension and --value are set together');
    }
    if (dimension) query.dimension = oneOf(dimension, DIMENSIONS[spec.dimension], 'dimension');
    if (value) query.value = value;
    return;
  }
  if (!dimension) throw new Error(`--dimension is required for analytics product ${view}`);
  query.dimension = oneOf(dimension, DIMENSIONS[spec.dimension], 'dimension');
};

/**
 * Map `rheo analytics product` argv (after the `product` token) to a dashboard request.
 * Returns null when the view is unknown.
 */
export const planProductAnalyticsRequest = (
  args: string[],
  flags: CliFlags,
): { path: string; query: QueryParams } | null => {
  const [view, appId] = args;
  if (!view || !(PRODUCT_ANALYTICS_VIEWS as readonly string[]).includes(view)) return null;
  if (!appId) throw new Error('Missing <appId>');
  const spec = VIEWS[view as ProductAnalyticsView];
  const platform = flagString(flags, 'platform');
  const query: QueryParams = {
    environment: parseEnvironment(flagString(flags, 'env')),
    platform: platform ? oneOf(platform, PLATFORMS, 'platform') : undefined,
    segmentId: flagString(flags, 'segment-id'),
  };
  if (spec.dates) {
    const range = resolveDateRange({
      start: flagString(flags, 'start'),
      end: flagString(flags, 'end'),
    });
    query.startDate = range.startDate;
    query.endDate = range.endDate;
  }
  if (spec.grain) {
    const grain = flagString(flags, 'grain');
    if (grain) query.grain = oneOf(grain, GRAINS, 'grain');
  }
  applyDimension(view, spec, flags, query);
  if (spec.name) {
    const name = flagString(flags, 'name');
    if (!name) throw new Error('--name is required for analytics product recent');
    query.name = name;
  }
  if (spec.attribution) {
    assignSingle(query, flags, [
      ['source', 'source'],
      ['campaign', 'campaign'],
      ['medium', 'medium'],
      ['content', 'content'],
      ['term', 'term'],
      ['adset', 'adset'],
      ['creative', 'creative'],
    ]);
  }
  if (spec.technology) {
    assignSingle(query, flags, [
      ['browsers', 'browsers'],
      ['operating-systems', 'operatingSystems'],
      ['devices', 'devices'],
    ]);
  }
  if (spec.demographic) {
    assignSingle(query, flags, [
      ['country', 'country'],
      ['region', 'region'],
      ['city', 'city'],
    ]);
  }
  if (spec.engagement) {
    assignSingle(query, flags, [
      ['page', 'page'],
      ['entry', 'entry'],
      ['exit', 'exit'],
    ]);
  }
  if (spec.cross) assignCross(query, flags);
  return { path: `/v1/dashboard/apps/${appId}/product-analytics${spec.path}`, query };
};

export const runProductAnalyticsCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
}): Promise<number> => {
  const plan = planProductAnalyticsRequest(opts.args, opts.flags);
  if (!plan) {
    process.stderr.write(`Unknown product analytics view: ${opts.args[0] ?? '(none)'}\n`);
    process.stderr.write(PRODUCT_ANALYTICS_USAGE);
    return 1;
  }
  printJson(await opts.http.get(plan.path, plan.query));
  return 0;
};
