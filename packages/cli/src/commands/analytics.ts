import type { HttpClient } from '../http.js';
import { resolveDateRange } from '../dateRange.js';
import { parseEnvironment } from '../query.js';
import { printJson } from '../format.js';

export const FLOW_ANALYTICS_KINDS = [
  'overview',
  'funnel',
  'dropoff',
  'timeseries',
  'timeseries-cohorts',
  'cvr-heatmap',
  'step-duration',
  'cohorts',
  'cohort-keys',
  'purchases',
  'responses',
] as const;

export type FlowAnalyticsKind = (typeof FLOW_ANALYTICS_KINDS)[number];

export const isFlowAnalyticsKind = (raw: string): raw is FlowAnalyticsKind =>
  (FLOW_ANALYTICS_KINDS as readonly string[]).includes(raw);

export const runAnalyticsAppOverview = async (opts: {
  http: HttpClient;
  appId: string;
  env?: string;
  start?: string;
  end?: string;
  flowId?: string;
}): Promise<number> => {
  const range = resolveDateRange({ start: opts.start, end: opts.end });
  const environment = parseEnvironment(opts.env);
  const body = await opts.http.get(`/v1/dashboard/apps/${opts.appId}/analytics/overview`, {
    environment,
    startDate: range.startDate,
    endDate: range.endDate,
    flowId: opts.flowId,
  });
  printJson(body);
  return 0;
};

export const runAnalyticsFlow = async (opts: {
  http: HttpClient;
  kind: FlowAnalyticsKind;
  flowId: string;
  env?: string;
  start?: string;
  end?: string;
  versionId?: string;
  dimension?: string;
  customKey?: string;
}): Promise<number> => {
  const range = resolveDateRange({ start: opts.start, end: opts.end });
  const environment = parseEnvironment(opts.env);
  const needsDimension = opts.kind === 'cohorts' || opts.kind === 'timeseries-cohorts';
  if (needsDimension && !opts.dimension) {
    throw new Error(`--dimension is required for analytics ${opts.kind}`);
  }
  if (opts.dimension === 'custom_property' && !opts.customKey) {
    throw new Error('--custom-key is required when --dimension=custom_property');
  }

  const body = await opts.http.get(`/v1/dashboard/flows/${opts.flowId}/analytics/${opts.kind}`, {
    environment,
    startDate: range.startDate,
    endDate: range.endDate,
    versionId: opts.versionId,
    dimension: needsDimension ? opts.dimension : undefined,
    customKey: needsDimension ? opts.customKey : undefined,
  });
  printJson(body);
  return 0;
};
