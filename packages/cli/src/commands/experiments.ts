import type { HttpClient } from '../http.js';
import { resolveDateRange } from '../dateRange.js';
import { printJson, printTable } from '../format.js';

type ExperimentItem = {
  id: string;
  name?: string;
  status?: string;
  channelId?: string;
  archivedAt?: string | null;
};

export const runExperimentsList = async (opts: {
  http: HttpClient;
  appId: string;
  includeArchived?: boolean;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get(`/v1/dashboard/apps/${opts.appId}/experiments`, {
    includeArchived: opts.includeArchived ? 'true' : undefined,
  })) as { items: ExperimentItem[] };

  if (opts.json) {
    printJson(body);
    return 0;
  }

  printTable(
    body.items.map((e) => ({
      id: e.id,
      name: e.name ?? '',
      status: e.status ?? '',
      channelId: e.channelId ?? '',
      archived: e.archivedAt ? 'yes' : 'no',
    })),
  );
  return 0;
};

export const runExperimentsGet = async (opts: {
  http: HttpClient;
  experimentId: string;
}): Promise<number> => {
  printJson(await opts.http.get(`/v1/dashboard/experiments/${opts.experimentId}`));
  return 0;
};

const statsQuery = (opts: {
  start?: string;
  end?: string;
  cohorts?: string;
  cohortDimension?: string;
  cohortKey?: string;
  customKey?: string;
  dimension?: string;
}) => {
  const range = resolveDateRange({ start: opts.start, end: opts.end });
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    cohorts: opts.cohorts,
    cohortDimension: opts.cohortDimension,
    cohortKey: opts.cohortKey,
    customKey: opts.customKey,
    dimension: opts.dimension,
  };
};

export const runExperimentsStats = async (opts: {
  http: HttpClient;
  experimentId: string;
  start?: string;
  end?: string;
  cohorts?: string;
  cohortDimension?: string;
  cohortKey?: string;
  customKey?: string;
}): Promise<number> => {
  printJson(
    await opts.http.get(`/v1/dashboard/experiments/${opts.experimentId}/stats`, {
      ...statsQuery(opts),
      dimension: undefined,
    }),
  );
  return 0;
};

export const runExperimentsStatsTimeseries = async (opts: {
  http: HttpClient;
  experimentId: string;
  start?: string;
  end?: string;
  cohorts?: string;
  cohortDimension?: string;
  cohortKey?: string;
  customKey?: string;
}): Promise<number> => {
  printJson(
    await opts.http.get(
      `/v1/dashboard/experiments/${opts.experimentId}/stats/cvr-timeseries`,
      {
        ...statsQuery(opts),
        dimension: undefined,
      },
    ),
  );
  return 0;
};

export const runExperimentsCohortKeys = async (opts: {
  http: HttpClient;
  experimentId: string;
  start?: string;
  end?: string;
  cohorts?: string;
}): Promise<number> => {
  const range = resolveDateRange({ start: opts.start, end: opts.end });
  printJson(
    await opts.http.get(`/v1/dashboard/experiments/${opts.experimentId}/stats/cohort-keys`, {
      startDate: range.startDate,
      endDate: range.endDate,
      cohorts: opts.cohorts,
    }),
  );
  return 0;
};

export const runExperimentsCohortValues = async (opts: {
  http: HttpClient;
  experimentId: string;
  dimension: string;
  customKey?: string;
  start?: string;
  end?: string;
  cohorts?: string;
}): Promise<number> => {
  const range = resolveDateRange({ start: opts.start, end: opts.end });
  printJson(
    await opts.http.get(`/v1/dashboard/experiments/${opts.experimentId}/stats/cohort-values`, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimension: opts.dimension,
      customKey: opts.customKey,
      cohorts: opts.cohorts,
    }),
  );
  return 0;
};

export const runExperimentsCreate = async (opts: {
  http: HttpClient;
  appId: string;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/apps/${opts.appId}/experiments`, opts.body));
  return 0;
};

export const runExperimentsUpdate = async (opts: {
  http: HttpClient;
  experimentId: string;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.patch(`/v1/dashboard/experiments/${opts.experimentId}`, opts.body));
  return 0;
};

export const runExperimentsDelete = async (opts: {
  http: HttpClient;
  experimentId: string;
}): Promise<number> => {
  printJson(await opts.http.delete(`/v1/dashboard/experiments/${opts.experimentId}`));
  return 0;
};

export const runExperimentsAddVariant = async (opts: {
  http: HttpClient;
  experimentId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.post(`/v1/dashboard/experiments/${opts.experimentId}/variants`, opts.body),
  );
  return 0;
};

export const runExperimentsUpdateVariant = async (opts: {
  http: HttpClient;
  experimentId: string;
  variantId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.patch(
      `/v1/dashboard/experiments/${opts.experimentId}/variants/${opts.variantId}`,
      opts.body,
    ),
  );
  return 0;
};

export const runExperimentsDeleteVariant = async (opts: {
  http: HttpClient;
  experimentId: string;
  variantId: string;
}): Promise<number> => {
  await opts.http.delete(
    `/v1/dashboard/experiments/${opts.experimentId}/variants/${opts.variantId}`,
  );
  printJson({ ok: true });
  return 0;
};

export const runExperimentsReorderVariants = async (opts: {
  http: HttpClient;
  experimentId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.patch(
      `/v1/dashboard/experiments/${opts.experimentId}/variants/reorder`,
      opts.body,
    ),
  );
  return 0;
};

export const runExperimentsStatus = async (opts: {
  http: HttpClient;
  experimentId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.patch(`/v1/dashboard/experiments/${opts.experimentId}/status`, opts.body),
  );
  return 0;
};

export const runExperimentsExtend = async (opts: {
  http: HttpClient;
  experimentId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.post(`/v1/dashboard/experiments/${opts.experimentId}/extend`, opts.body),
  );
  return 0;
};

export const runExperimentsStop = async (opts: {
  http: HttpClient;
  experimentId: string;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/experiments/${opts.experimentId}/stop`, opts.body));
  return 0;
};

export const runExperimentsPromote = async (opts: {
  http: HttpClient;
  experimentId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.post(`/v1/dashboard/experiments/${opts.experimentId}/promote`, opts.body),
  );
  return 0;
};
